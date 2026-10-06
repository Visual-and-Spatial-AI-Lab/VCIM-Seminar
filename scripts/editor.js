/* Local editor: edit -> validate -> download. Never writes to a remote server. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const C = window.VCIM;
  if (!C || !window.VCIM_DATA) { $('validation-errors').hidden = false; $('validation-errors').textContent = 'The content files could not be loaded. Keep the original folder structure and reopen this editor.'; return; }
  let data = C.clone(window.VCIM_DATA);
  let activeId = (data.semesters.find(term => term.status === 'current') || C.orderedSemesters(data)[0]).id;
  let dirty = false, autosaveTimer;
  const draftKey = `vcim-editor-draft-v1:${location.pathname}`;
  const statusLabel = { current: 'In progress', upcoming: 'Coming soon', completed: 'Completed' };
  const active = () => data.semesters.find(term => term.id === activeId);
  const make = (tag, className, text) => {
    const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;
  };
  function feedback(message) { $('editor-feedback').textContent = message; $('editor-feedback').hidden = false; }
  function showErrors(errors) {
    const node = $('validation-errors'); node.replaceChildren(); node.hidden = errors.length === 0;
    if (errors.length) { node.append(make('strong', '', 'Please check the following before exporting:')); const list = make('ul'); errors.forEach(error => list.append(make('li', '', error))); node.append(list); node.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
  function changed() {
    dirty = true; $('draft-status').textContent = 'Changes pending export.';
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(data)); $('draft-status').textContent = 'Draft saved in this browser. Export to update your website files.'; }
      catch (_) { $('draft-status').textContent = 'Browser draft storage is unavailable. Export to keep your changes.'; }
    }, 250);
  }
  function promoteCurrent(term) {
    const previous = data.semesters.filter(item => item.id !== term.id && item.status === 'current');
    previous.forEach(item => { item.status = 'completed'; });
    if (previous.length) feedback(`${previous.map(C.label).join(', ')} moved to the completed archive. ${C.label(term)} is now current.`);
  }
  function sidebar() {
    const list = $('editor-semesters'); list.replaceChildren();
    C.orderedSemesters(data).forEach(term => {
      const button = make('button', `editor-semester${term.id === activeId ? ' active' : ''}`); button.type = 'button'; button.dataset.semester = term.id;
      button.setAttribute('aria-pressed', String(term.id === activeId));
      button.append(make('span', '', C.label(term)), make('small', '', `${statusLabel[term.status]} · ${term.talks.length} ${term.talks.length === 1 ? 'talk' : 'talks'}`));
      button.addEventListener('click', () => { activeId = term.id; render(); }); list.append(button);
    });
    $('semester-number').textContent = data.semesters.length;
  }
  function updateHeading() {
    const term = active(); $('editing-heading').textContent = C.label(term); $('editing-id').textContent = term.id;
    $('editing-count').textContent = `${term.talks.length} ${term.talks.length === 1 ? 'talk' : 'talks'}`;
  }
  function inputField(text, type, value, id, onChange, className = '') {
    const label = make('label', className, text); label.htmlFor = id;
    const input = make(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    input.id = id; input.value = value;
    if (type === 'date') { input.min = `${active().year}-01-01`; input.max = `${active().year}-12-31`; }
    if (type === 'date' || type === 'text') input.required = true;
    input.addEventListener('input', event => { onChange(event.target.value); changed(); });
    label.append(input); return label;
  }
  function talkFields() {
    const list = $('editor-talks'); list.replaceChildren(); const term = active();
    $('no-talks').hidden = term.talks.length > 0;
    term.talks.forEach((talk, index) => {
      const card = make('section', 'edit-talk'); card.setAttribute('aria-label', `Talk ${index + 1}`);
      const heading = make('div', 'talk-edit-heading'); heading.append(make('span', '', `Talk ${String(index + 1).padStart(2, '0')}`));
      const remove = make('button', 'remove-talk', 'Remove ×'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove talk ${index + 1}`);
      remove.addEventListener('click', () => {
        if ((talk.speaker || talk.date) && !confirm(`Remove ${talk.speaker || 'this talk'} from the local draft?`)) return;
        term.talks.splice(index, 1); changed(); sidebar(); updateHeading(); talkFields();
      });
      heading.append(remove);
      const fields = make('div', 'talk-edit-fields');
      fields.append(inputField('Date', 'date', talk.date, `talk-${index}-date`, value => { talk.date = value; }),
        inputField('Speaker name', 'text', talk.speaker, `talk-${index}-speaker`, value => { talk.speaker = value; }),
        inputField('Talk title — use TBD if not yet announced', 'textarea', talk.title, `talk-${index}-title`, value => { talk.title = value; }, 'talk-title-field'));
      card.append(heading, fields); list.append(card);
    });
  }
  function settings() {
    $('site-chair').value = data.site.chair; $('site-support').value = data.site.support.join('\n');
    $('site-program-url').value = data.site.programUrl; $('site-college-url').value = data.site.collegeUrl; $('site-timezone').value = data.site.timeZone;
  }
  function render() {
    sidebar(); updateHeading();
    const term = active(); $('edit-season').value = term.season; $('edit-year').value = term.year; $('edit-status').value = term.status;
    $('delete-semester').disabled = data.semesters.length < 2;
    talkFields(); settings();
  }
  function renameTerm() {
    const term = active(), season = $('edit-season').value, year = Number($('edit-year').value);
    if (!Number.isInteger(year) || year < 2000 || year > 2199) { showErrors(['Enter a year from 2000 to 2199.']); $('edit-year').value = term.year; return; }
    if (data.semesters.some(item => item.id !== term.id && item.season === season && item.year === year)) {
      showErrors([`${season} ${year} already exists.`]); $('edit-season').value = term.season; $('edit-year').value = term.year; return;
    }
    term.season = season; term.year = year;
    // Preserve the published ID when relabeling, so existing links do not break.
    changed(); sidebar(); updateHeading(); talkFields();
  }
  $('edit-season').addEventListener('change', renameTerm); $('edit-year').addEventListener('change', renameTerm);
  $('edit-status').addEventListener('change', event => { const term = active(); term.status = event.target.value; if (term.status === 'current') promoteCurrent(term); changed(); sidebar(); });
  $('add-talk').addEventListener('click', () => {
    active().talks.push({ date: '', speaker: '', title: 'TBD' }); changed(); sidebar(); updateHeading(); talkFields();
    const input = $(`talk-${active().talks.length - 1}-date`); input.scrollIntoView({ block: 'center', behavior: 'smooth' }); input.focus({ preventScroll: true });
  });
  $('sort-talks').addEventListener('click', () => { active().talks = C.orderedTalks(active()); changed(); talkFields(); feedback('Talks sorted by date. The public website also sorts dates automatically.'); });
  $('delete-semester').addEventListener('click', () => {
    if (data.semesters.length < 2) return;
    if (!confirm(`Delete ${C.label(active())} and its ${active().talks.length} talks from this local draft? This takes effect on your website only after exporting and publishing the replacement file.`)) return;
    data.semesters = data.semesters.filter(term => term.id !== activeId); activeId = C.orderedSemesters(data)[0].id; changed(); render();
  });
  $('show-new-semester').addEventListener('click', () => {
    const term = active(); $('new-season').value = term.season === 'Fall' ? 'Spring' : 'Fall'; $('new-year').value = term.year + (term.season === 'Fall' ? 1 : 0); $('new-status').value = 'upcoming'; $('new-semester-error').hidden = true;
    $('new-semester-dialog').showModal();
  });
  $('cancel-new-semester').addEventListener('click', () => $('new-semester-dialog').close());
  $('new-semester-form').addEventListener('submit', event => {
    event.preventDefault();
    const season = $('new-season').value, year = Number($('new-year').value), id = `${season.toLowerCase()}-${year}`;
    if (data.semesters.some(term => term.id === id || (term.season === season && term.year === year))) { $('new-semester-error').textContent = `${season} ${year} already exists. Choose it in the semester list.`; $('new-semester-error').hidden = false; return; }
    const term = { id, season, year, status: $('new-status').value, talks: [] };
    data.semesters.push(term); activeId = id; if (term.status === 'current') promoteCurrent(term);
    changed(); render(); $('new-semester-dialog').close(); feedback(`${C.label(term)} created. Add talks below, then export the updated content file.`);
  });
  const settingsMap = { 'site-chair': 'chair', 'site-program-url': 'programUrl', 'site-college-url': 'collegeUrl', 'site-timezone': 'timeZone' };
  Object.entries(settingsMap).forEach(([id, key]) => $(id).addEventListener('input', event => { data.site[key] = event.target.value.trim(); changed(); }));
  $('site-support').addEventListener('input', event => { data.site.support = event.target.value.split('\n').map(name => name.trim()).filter(Boolean); changed(); });
  $('check-content').addEventListener('click', () => { const errors = C.validate(data); showErrors(errors); if (!errors.length) feedback(`Content checks passed: ${data.semesters.length} semesters and ${data.semesters.reduce((count, term) => count + term.talks.length, 0)} talks. Ready to export.`); });
  $('export-file').addEventListener('click', () => {
    const errors = C.validate(data); showErrors(errors); if (errors.length) return;
    const output = C.clone(data); output.semesters = C.orderedSemesters(output); output.semesters.forEach(term => { term.talks = C.orderedTalks(term); });
    C.download(C.contentFile(output), 'seminars.js', 'text/javascript;charset=utf-8'); dirty = false;
    clearTimeout(autosaveTimer); try { localStorage.removeItem(draftKey); } catch (_) { /* Optional local storage. */ }
    $('draft-notice').hidden = true; $('draft-status').textContent = 'Exported. Replace data/seminars.js and publish the updated file.';
    feedback('Content file downloaded. Replace data/seminars.js in your website folder, then reload the website and upload the updated file to your host.');
  });
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a content file smaller than 2 MB.');
      const imported = C.parseContent(await file.text()); const errors = C.validate(imported);
      if (errors.length) { showErrors(errors); return; }
      if (dirty && !confirm('Replace the current local editing draft with the imported content?')) return;
      data = C.clone(imported); activeId = (data.semesters.find(term => term.status === 'current') || C.orderedSemesters(data)[0]).id;
      changed(); render(); showErrors([]); feedback(`Loaded ${file.name}. Review the content, then export when ready.`);
    } catch (error) { showErrors([error.message || 'The content file could not be read.']); }
    finally { event.target.value = ''; }
  });
  $('restore-draft').addEventListener('click', () => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey));
      // Incomplete new talk rows are allowed in drafts; strict validation runs on export.
      if (!saved || saved.schemaVersion !== 1 || !saved.site || !Array.isArray(saved.semesters) || !saved.semesters.length || saved.semesters.some(term => !Array.isArray(term.talks))) throw new Error('The saved draft is not readable.');
      data = saved; activeId = (data.semesters.find(term => term.status === 'current') || C.orderedSemesters(data)[0]).id;
      dirty = true; render(); $('draft-notice').hidden = true; feedback('Local editing draft restored.');
    } catch (error) { showErrors([error.message]); }
  });
  $('discard-draft').addEventListener('click', () => { if (!confirm('Discard the previously saved browser draft? The website content file will not change.')) return; try { localStorage.removeItem(draftKey); } catch (_) {} $('draft-notice').hidden = true; });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  try { $('draft-notice').hidden = !localStorage.getItem(draftKey); } catch (_) { /* File viewers may block local storage. */ }
  const initialErrors = C.validate(data); if (initialErrors.length) showErrors(initialErrors);
  render();
})();
