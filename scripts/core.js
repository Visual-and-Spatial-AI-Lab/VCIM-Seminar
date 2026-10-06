/* Shared, dependency-free data helpers. Used by the website and local editor. */
(function () {
  'use strict';
  const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];
  const statuses = ['upcoming', 'current', 'completed'];
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const label = semester => `${semester.season} ${semester.year}`;
  const clone = value => JSON.parse(JSON.stringify(value));

  function isDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function today(timeZone = 'America/Chicago') {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = type => parts.find(item => item.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  function dateText(value, options = {}) {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(new Date(`${value}T12:00:00Z`));
  }
  function orderedSemesters(data) {
    return [...data.semesters].sort((a, b) => b.year - a.year || seasons.indexOf(b.season) - seasons.indexOf(a.season));
  }
  function orderedTalks(semester) {
    return [...semester.talks].sort((a, b) => a.date.localeCompare(b.date));
  }
  function displayTitle(title) {
    return !title || /^(TBD|TBA|TDB)$/i.test(title.trim()) ? 'Title to be announced' : title.trim();
  }
  function safeURL(value) {
    try { return new URL(value).protocol === 'https:'; } catch (_) { return false; }
  }
  function validate(data) {
    const errors = [];
    if (!isObject(data)) return ['The content must be an object.'];
    if (data.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
    if (!isObject(data.site)) errors.push('The site settings are missing.');
    else {
      ['name', 'program', 'university', 'college', 'chair'].forEach(key => {
        if (typeof data.site[key] !== 'string' || !data.site[key].trim()) errors.push(`site.${key} must be nonempty text.`);
      });
      ['programUrl', 'collegeUrl'].forEach(key => {
        if (!safeURL(data.site[key])) errors.push(`site.${key} must be a valid HTTPS URL.`);
      });
      if (!Array.isArray(data.site.support) || data.site.support.some(name => typeof name !== 'string' || !name.trim())) errors.push('site.support must be an array of names.');
      try { new Intl.DateTimeFormat('en-US', { timeZone: data.site.timeZone }).format(); }
      catch (_) { errors.push('site.timeZone must be a valid timezone, such as America/Chicago.'); }
    }
    if (!Array.isArray(data.semesters) || !data.semesters.length) return [...errors, 'At least one semester is required.'];
    const ids = new Set();
    const terms = new Set();
    let currents = 0;
    data.semesters.forEach((semester, i) => {
      const where = `Semester ${i + 1}`;
      if (!isObject(semester)) { errors.push(`${where} must be an object.`); return; }
      if (typeof semester.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(semester.id)) errors.push(`${where}: use a lowercase, hyphen-separated ID.`);
      if (ids.has(semester.id)) errors.push(`${where}: duplicate ID ${semester.id}.`);
      ids.add(semester.id);
      if (!seasons.includes(semester.season)) errors.push(`${where}: choose Winter, Spring, Summer, or Fall.`);
      if (!Number.isInteger(semester.year) || semester.year < 2000 || semester.year > 2199) errors.push(`${where}: enter a four-digit year from 2000 to 2199.`);
      if (terms.has(label(semester))) errors.push(`${where}: ${label(semester)} appears more than once.`);
      terms.add(label(semester));
      if (!statuses.includes(semester.status)) errors.push(`${where}: status must be upcoming, current, or completed.`);
      if (semester.status === 'current') currents++;
      if (!Array.isArray(semester.talks)) { errors.push(`${where}: talks must be an array.`); return; }
      semester.talks.forEach((talk, j) => {
        const context = `${label(semester)}, talk ${j + 1}`;
        if (!isObject(talk)) { errors.push(`${context}: invalid talk.`); return; }
        if (!isDate(talk.date)) errors.push(`${context}: use a real date in YYYY-MM-DD format.`);
        else if (Number(talk.date.slice(0, 4)) !== semester.year) errors.push(`${context}: the date must belong to ${semester.year}.`);
        if (typeof talk.speaker !== 'string' || !talk.speaker.trim()) errors.push(`${context}: a speaker name is required.`);
        if (typeof talk.title !== 'string') errors.push(`${context}: title must be text. Use TBD when not announced.`);
        if (Object.keys(talk).some(key => !['date', 'speaker', 'title'].includes(key))) errors.push(`${context}: use only date, speaker, and title fields.`);
      });
    });
    if (currents > 1) errors.push('Only one semester may have current status.');
    return errors;
  }
  function parseContent(text) {
    // Imported files are JSON-parsed, never executed.
    let source = text.replace(/^\uFEFF/, '').trim();
    if (!source.startsWith('{')) {
      source = source.replace(/^(?:\s*\/\/[^\n]*(?:\n|$))*/, '').trim();
      const match = source.match(/^window\.VCIM_DATA\s*=\s*([\s\S]*?)\s*;?\s*$/);
      if (!match) throw new Error('Choose a seminars.js file exported by this editor, or a JSON content file.');
      source = match[1];
    }
    return JSON.parse(source);
  }
  function contentFile(data) {
    return '// VCIM Seminar Series — the single source of truth for site content.\n' +
      '// Edit this file, or use tools/schedule-editor.html. Keep the object valid JSON.\n' +
      '// Talk records contain only date, speaker, and title. Dates use YYYY-MM-DD.\n' +
      `window.VCIM_DATA = ${JSON.stringify(data, null, 2)};\n`;
  }
  function download(contents, filename, type = 'text/plain;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
  function hash(text) {
    let result = 2166136261;
    for (let i = 0; i < text.length; i++) { result ^= text.charCodeAt(i); result = Math.imul(result, 16777619); }
    return (result >>> 0).toString(16);
  }
  function calendar(semester) {
    const escape = value => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//VCIM//Seminar Series//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:VCIM — ${label(semester)}`];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    orderedTalks(semester).forEach(talk => {
      const end = new Date(`${talk.date}T12:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      const summary = `${talk.speaker} — ${displayTitle(talk.title)}`;
      lines.push('BEGIN:VEVENT', `UID:${semester.id}-${hash(JSON.stringify(talk))}@vcim-seminars`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${talk.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`,
        `SUMMARY:${escape(summary)}`, 'DESCRIPTION:Date-only seminar reminder. Talk times and locations are not included.', 'TRANSP:TRANSPARENT', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    // RFC 5545: fold at 75 octets, not 75 characters, to preserve Unicode names.
    const encoder = new TextEncoder();
    return lines.map(line => {
      let segment = '', bytes = 0, result = '';
      for (const char of line) {
        const length = encoder.encode(char).length;
        if (bytes + length > 75) { result += segment + '\r\n'; segment = ' '; bytes = 1; }
        segment += char; bytes += length;
      }
      return result + segment;
    }).join('\r\n') + '\r\n';
  }
  window.VCIM = { seasons, statuses, label, clone, isDate, today, dateText, orderedSemesters, orderedTalks, displayTitle, validate, parseContent, contentFile, download, calendar };
})();
