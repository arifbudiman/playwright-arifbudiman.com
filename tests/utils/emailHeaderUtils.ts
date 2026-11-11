const IPV4 = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}';

const IPV6 =
  '(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}|' +
  '(?:[A-Fa-f0-9]{1,4}:){1,7}:|' +
  '(?:[A-Fa-f0-9]{1,4}:){1,6}:[A-Fa-f0-9]{1,4}|' +
  '(?:[A-Fa-f0-9]{1,4}:){1,5}(?::[A-Fa-f0-9]{1,4}){1,2}|' +
  '(?:[A-Fa-f0-9]{1,4}:){1,4}(?::[A-Fa-f0-9]{1,4}){1,3}|' +
  '(?:[A-Fa-f0-9]{1,4}:){1,3}(?::[A-Fa-f0-9]{1,4}){1,4}|' +
  '(?:[A-Fa-f0-9]{1,4}:){1,2}(?::[A-Fa-f0-9]{1,4}){1,5}|' +
  '[A-Fa-f0-9]{1,4}:(?::[A-Fa-f0-9]{1,4}){1,6}|' +
  ':(?:(?::[A-Fa-f0-9]{1,4}){1,7}|:)|' +
  `::(?:ffff(?::0{1,4})?:)?${IPV4}|` +
  `(?:[A-Fa-f0-9]{1,4}:){1,4}:${IPV4}`;

const IP_REGEX = new RegExp(`(?<![0-9A-Fa-f:.])(?:${IPV4}|${IPV6})(?![0-9A-Fa-f:.])`, 'gi');

const parseRawEmail = (raw: string) => {
  const normalized = raw.replace(/\r\n/g, '\n');
  const boundaryIdx = normalized.indexOf('\n\n');
  const headerBlock = boundaryIdx === -1 ? normalized : normalized.slice(0, boundaryIdx);
  const body = boundaryIdx === -1 ? '' : normalized.slice(boundaryIdx + 2);

  // Unfold continuation lines (RFC 5322 folding: line starts with space/tab)
  const unfolded = headerBlock.replace(/\n[ \t]+/g, ' ');
  const lines = unfolded.split('\n').filter(Boolean);

  const headers = []; // ordered array, preserves duplicates (e.g. multiple "Received")
  for (const line of lines) {
    const m = line.match(/^([^:\s][^:]*):\s?(.*)$/);
    const name = m?.[1];
    const value = m?.[2];
    if (name !== undefined && value !== undefined) {
      headers.push({ name: name.trim(), value: value.trim() });
    }
  }
  return { headers, body };
};

const getHeader = (headers: { name: string; value: string }[], name: string) => {
  const parsedHeaders = typeof headers === 'string' ? parseRawEmail(headers).headers : headers;

  return parsedHeaders.filter((h) => h.name.toLowerCase() === name.toLowerCase()).map((h) => h.value);
};

// ---------- Source IP extraction ----------
const isPrivateOrReservedIP = (ip: string) => {
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd');
  }
  return /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
};

const extractSourceIP = (headers: { name: string; value: string }[]) => {
  // 1. Received-SPF names the connecting client IP explicitly and is usually
  //    the most reliable signal for the IP that talked to the receiving MTA.
  for (const val of getHeader(headers, 'Received-SPF')) {
    const m = val.match(/client-ip=([^\s;]+)/i);
    const ip = m?.[1];
    if (ip && !isPrivateOrReservedIP(ip)) return ip;
  }

  // 2. Authentication-Results sometimes repeats "designates <ip> as permitted sender"
  for (const val of getHeader(headers, 'Authentication-Results')) {
    const m = val.match(/designates\s+([0-9a-fA-F:.]+)\s+as permitted/i);
    const ip = m?.[1];
    if (ip && !isPrivateOrReservedIP(ip)) return ip;
  }

  // 3. Some webmail providers stamp X-Originating-IP
  const xoip = getHeader(headers, 'X-Originating-IP')[0];
  if (xoip) {
    const m = xoip.match(IP_REGEX);
    if (m) return m[0];
  }

  // 4. Fall back to walking the Received chain from the bottom (closest to
  //    the original sender) upward, taking the first public IP found.
  const received = getHeader(headers, 'Received');
  for (let i = received.length - 1; i >= 0; i--) {
    const value = received[i];
    if (!value) continue;

    const ips = value.match(IP_REGEX) || [];
    const publicIp = ips.find((ip) => !isPrivateOrReservedIP(ip));
    if (publicIp) return publicIp;
  }

  return null;
};

// ---------- Date extraction ----------
const extractDate = (headers: { name: string; value: string }[]) => {
  const dateVal = getHeader(headers, 'Date')[0];
  if (!dateVal) return null;
  const parsed = new Date(dateVal);
  return {
    raw: dateVal,
    parsed: Number.isNaN(parsed.getTime()) ? null : parsed,
  };
};

const rdapLookup = async (ip: string) => {
  const res = await fetch(`https://rdap.org/ip/${ip}`);
  if (!res.ok) {
    throw new Error(`RDAP lookup failed with status ${res.status}`);
  }
  return await res.json();
};

const findAbuseContact = async (rdap: any) => {
  const searchEntities: any = (rdapEntities: any) => {
    for (const entity of rdapEntities || []) {
      if ((entity.roles || []).includes('abuse')) {
        const vcard = entity.vcardArray && entity.vcardArray[1];
        const emailEntry = vcard && vcard.find((v: any) => v[0] === 'email');
        if (emailEntry) return { email: emailEntry[3], org: entity.handle };
      }
      if (entity.entities) {
        const nested = searchEntities(entity.entities);
        if (nested) return nested;
      }
    }
    return null;
  };
  return searchEntities(rdap.entities);
};

const draftAbuseReport = ({ ip, date }: { ip: string | null; date: { raw: string; parsed: Date | null } | null }) => {
  return `A spam email was traced to an IP address within a network block under your management.

* Source IP address: ${ip}
* Date/time of abuse: ${date ? date.raw : 'an unknown date'}
* Type of abuse: Spam abuse. The email was sent unsolicited without any prior relationship or consent. Opt-out mechanism is either missing, bogus, or non-effective. The sender does not appear to validate email addresses provided by their prospects, clients, subscribers, or customers.

Full headers are included in the attachment; please investigate and take appropriate action to prevent further abuse.`;
};

export default { parseRawEmail, extractSourceIP, extractDate, draftAbuseReport, findAbuseContact, rdapLookup };
