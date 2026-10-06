/* Public schedule UI. All speaker content comes from data/seminars.js. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const data = window.VCIM_DATA;
  const C = window.VCIM;
  let toastTimer;
  function toast(message) {
    const node = $('toast'); node.textContent = message; node.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 5000);
  }
  const errors = C ? C.validate(data) : ['The shared script could not be loaded.'];
  if (errors.length) {
    $('schedule-error').hidden = false;
    $('schedule-error').textContent = 'The schedule could not be loaded. Please check data/seminars.js. ' + errors[0];
    $('schedule-app').hidden = true;
    return;
  }
  const semesters = C.orderedSemesters(data);
  const current = semesters.find(term => term.status === 'current');
  let active = semesters.find(term => term.id === new URLSearchParams(location.search).get('semester')) || current || semesters[0];
  let filter = 'all';
  let query = '';
  let today = C.today(data.site.timeZone);
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const statusText = { current: 'In progress', completed: 'Completed', upcoming: 'Coming soon' };
  const countText = count => `${count} ${count === 1 ? 'talk' : 'talks'}`;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function nextTalk(term) {
    if (term.status === 'completed') return undefined;
    return C.orderedTalks(term).find(talk => talk.date >= today);
  }
  function setURL() {
    const url = new URL(location.href);
    url.searchParams.set('semester', active.id);
    try { history.replaceState({ semester: active.id }, '', url); } catch (_) { /* Some file viewers restrict history. */ }
  }
  function renderTabs() {
    const tabs = $('semester-tabs'); tabs.replaceChildren();
    semesters.filter(term => term.year === active.year).forEach(term => {
      const button = make('button', 'semester-tab', C.label(term));
      button.type = 'button'; button.id = `tab-${term.id}`; button.role = 'tab'; button.dataset.semester = term.id;
      button.setAttribute('aria-selected', String(term.id === active.id));
      button.setAttribute('aria-controls', 'semester-panel');
      button.tabIndex = term.id === active.id ? 0 : -1;
      if (term.status === 'current') {
        const dot = make('span', 'tab-status-dot'); dot.setAttribute('aria-hidden', 'true'); button.append(dot);
      }
      button.addEventListener('click', () => selectSemester(term.id, true));
      tabs.append(button);
    });
    $('semester-panel').setAttribute('aria-labelledby', `tab-${active.id}`);
    $('year-select').value = String(active.year);
  }
  function renderSummary() {
    $('semester-title').textContent = C.label(active);
    $('semester-status').textContent = statusText[active.status];
    $('semester-status').dataset.status = active.status;
    $('filter-total').textContent = active.talks.length;
    const talks = C.orderedTalks(active);
    $('semester-range').textContent = talks.length ? `${C.dateText(talks[0].date, { month: 'short', day: 'numeric' })} – ${C.dateText(talks[talks.length - 1].date, { month: 'short', day: 'numeric' })} · Published dates` : 'Schedule to be announced';
    $('calendar-button').disabled = !talks.length;
    $('calendar-button').setAttribute('aria-label', `Save ${C.label(active)} seminar dates as a date-only calendar. Talk times are not included.`);
    document.title = `${C.label(active)} · VCIM Seminar Series · Texas A&M University`;
  }
  function renderTalks() {
    const all = C.orderedTalks(active);
    const next = nextTalk(active);
    const matches = all.filter(talk => {
      const dateMatches = filter === 'all' || (filter === 'upcoming' ? talk.date >= today : talk.date < today);
      const textMatches = !query || normalize(`${talk.speaker} ${talk.title} ${C.displayTitle(talk.title)}`).includes(normalize(query));
      return dateMatches && textMatches;
    });
    const list = $('talk-list'); list.replaceChildren();
    if (matches.length) {
      const header = make('div', 'talk-header'); header.setAttribute('aria-hidden', 'true');
      ['Date', 'Speaker', 'Talk title'].forEach(text => header.append(make('span', '', text)));
      list.append(header);
    }
    matches.forEach(talk => {
      const isNext = talk === next;
      const article = make('article', `talk-row${isNext ? ' next-talk' : ''}`);
      const date = make('time', 'talk-date'); date.dateTime = talk.date;
      date.setAttribute('aria-label', C.dateText(talk.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
      const day = make('span', 'date-day', talk.date.slice(8)); day.setAttribute('aria-hidden', 'true');
      const detail = make('span', 'date-detail'); detail.setAttribute('aria-hidden', 'true');
      detail.append(make('span', 'date-month', C.dateText(talk.date, { month: 'short' })), make('span', 'date-weekday', C.dateText(talk.date, { weekday: 'short' })));
      if (isNext) { const tag = make('span', 'next-tag', talk.date === today ? 'Today' : 'Next talk'); const dot = make('span', 'status-dot'); tag.prepend(dot); detail.append(tag); }
      date.append(day, detail);
      const speaker = make('div', 'talk-speaker', talk.speaker);
      const titleText = C.displayTitle(talk.title);
      const title = make('h4', `talk-title${titleText === 'Title to be announced' ? ' title-tba' : ''}`, titleText);
      article.append(date, speaker, title); list.append(article);
    });
    $('empty-state').hidden = matches.length > 0;
    if (!all.length) {
      $('empty-title').textContent = 'The next conversation is taking shape.';
      $('empty-description').textContent = `Speakers and dates for ${C.label(active)} will appear here when announced.`;
      $('reset-filters').hidden = true;
    } else if (!matches.length) {
      $('empty-title').textContent = filter === 'upcoming' && !query ? 'No upcoming dates listed.' : 'No talks found.';
      $('empty-description').textContent = filter === 'upcoming' && !query ? 'Explore the full semester schedule, or browse another semester.' : 'Try a different speaker or title, or reset the filters.';
      $('reset-filters').hidden = false;
    }
    $('result-count').textContent = matches.length === all.length ? `${countText(all.length)} in ${C.label(active)}` : `${matches.length} of ${countText(all.length)} · ${C.label(active)}`;
    document.querySelectorAll('[data-filter]').forEach(button => {
      const selected = button.dataset.filter === filter;
      button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
    });
  }
  function selectSemester(id, focusTab = false) {
    const term = semesters.find(semester => semester.id === id);
    if (!term) return;
    active = term; filter = 'all'; query = ''; $('talk-search').value = '';
    renderTabs(); renderSummary(); renderTalks(); setURL();
    if (focusTab) $(`tab-${active.id}`).focus({ preventScroll: true });
  }
  function renderHero() {
    $('total-talks').textContent = String(semesters.reduce((sum, term) => sum + term.talks.length, 0)).padStart(2, '0');
    $('total-semesters').textContent = String(semesters.length).padStart(2, '0');
    const future = semesters.filter(term => term.status !== 'completed').flatMap(term => term.talks.map(talk => ({ term, talk }))).filter(item => item.talk.date >= today).sort((a, b) => a.talk.date.localeCompare(b.talk.date));
    const item = future[0];
    if (item) {
      $('next-label').textContent = `${item.talk.date === today ? 'Today' : 'Next seminar'} / ${C.label(item.term)}`;
      $('next-speaker').textContent = item.talk.speaker;
      $('next-date').textContent = C.dateText(item.talk.date, { month: 'short', day: 'numeric' });
      $('next-strip').setAttribute('aria-label', `${item.talk.speaker}, ${C.dateText(item.talk.date, { month: 'long', day: 'numeric', year: 'numeric' })}. ${C.displayTitle(item.talk.title)}. View schedule.`);
      $('next-strip').onclick = () => selectSemester(item.term.id);
    } else {
      const term = current || semesters[0];
      $('next-label').textContent = `${C.label(term)} / ${statusText[term.status]}`;
      $('next-speaker').textContent = 'Explore the conversations';
      $('next-date').textContent = countText(term.talks.length);
      $('next-strip').onclick = () => selectSemester(term.id);
    }
  }
  function setSiteContent() {
    $('chair-name').textContent = data.site.chair;
    $('support-names').replaceChildren(...data.site.support.map(name => make('div', '', name)));
    document.querySelectorAll('[data-program-link]').forEach(link => { link.href = data.site.programUrl; });
    document.querySelectorAll('[data-college-link]').forEach(link => { link.href = data.site.collegeUrl; });
    $('copyright-year').textContent = today.slice(0, 4);
    const years = [...new Set(semesters.map(term => term.year))];
    $('year-select').replaceChildren(...years.map(year => { const option = make('option', '', String(year)); option.value = year; return option; }));
  }

  $('year-select').addEventListener('change', event => selectSemester(semesters.find(term => term.year === Number(event.target.value)).id));
  $('semester-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...$('semester-tabs').querySelectorAll('[role=tab]')];
    const index = tabs.findIndex(tab => tab.dataset.semester === active.id);
    const position = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault(); selectSemester(tabs[position].dataset.semester, true);
    $(`tab-${active.id}`).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; renderTalks(); }));
  $('talk-search').addEventListener('input', event => { query = event.target.value.trim(); renderTalks(); });
  $('reset-filters').addEventListener('click', () => { filter = 'all'; query = ''; $('talk-search').value = ''; renderTalks(); $('talk-search').focus(); });
  $('calendar-button').addEventListener('click', () => { C.download(C.calendar(active), `vcim-${active.id}.ics`, 'text/calendar;charset=utf-8'); toast('Date-only calendar downloaded. Talk times are not included.'); });
  $('print-button').addEventListener('click', () => window.print());
  $('share-button').addEventListener('click', async () => {
    const url = new URL(location.href); url.searchParams.set('semester', active.id); url.hash = 'schedule';
    if (location.protocol === 'file:') { toast('This is a local preview. Publish the site to share a public semester link.'); return; }
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(url.href);
      else {
        const input = make('textarea'); input.value = url.href; input.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.append(input); input.select();
        const ok = document.execCommand('copy'); input.remove(); if (!ok) throw new Error('Copy unavailable');
      }
      toast('Semester link copied.');
    } catch (_) { window.prompt('Copy this semester link:', url.href); }
  });
  const menuButton = $('menu-toggle');
  function closeMenu() { $('mobile-nav').hidden = true; menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Open navigation'); }
  menuButton.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(expanded)); menuButton.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation'); $('mobile-nav').hidden = !expanded;
  });
  $('mobile-nav').querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('mobile-nav').hidden) { closeMenu(); menuButton.focus(); }
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) { event.preventDefault(); $('talk-search').focus(); }
  });
  matchMedia('(min-width:901px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  window.addEventListener('popstate', () => { const id = new URLSearchParams(location.search).get('semester'); selectSemester(id || (current || semesters[0]).id); });
  // A page left open overnight should not keep yesterday's date-based labels.
  function refreshDate() { const now = C.today(data.site.timeZone); if (now !== today) { today = now; renderHero(); renderTalks(); $('copyright-year').textContent = now.slice(0, 4); } }
  setInterval(refreshDate, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDate(); });
  setSiteContent(); renderHero(); renderTabs(); renderSummary(); renderTalks();
})();
