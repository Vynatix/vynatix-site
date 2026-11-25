// The rate calculator on the Career page (membership.html, #rate-calculator; the fourth block of app.js). Scope:
// root, the page the calculator is on (i18n.js reads its announcement on the Career page of each generated language).
//   node verify/calc.js
//
// The page works out, in the browser, what an hourly rate pays as a monthly salary. This check types figures into
// it and compares every figure on the card with the same model written a second time below (the search for the
// salary is a plain loop here and a division in app.js, on purpose). It also proves that the cost lines add up to
// the total they sit above, that the share slider stays out of sight at 70 per cent until the first title has been
// clicked five times (and that nothing hints at it), that the car fields appear only when asked for and count only then, that a negative or
// absurd figure is survived, that nothing is stored, that the result is announced once typing stops, that the
// layout holds on a phone and a desktop, and that without JavaScript the calculator is not shown and the page says
// so (no dead control).
//
// The constants are the ones the page prints; a change to a term is made in app.js, in the labels of
// membership.html and here, together.
const { BASE, launch, scopeLine } = require('./_common');

const EMPLOYER_FEE = 0.3142;
const HOLIDAY = 5 / 52;
const PENSION = 0.045;
const PENSION_TAX = 0.2426;
const SALARY_COST = 1.57;

// The model, as the calculator this one was built from wrote it.
function expected(v) {
  const revenue = v.rate * v.hours * (v.share / 100);
  const fixed = v.health + v.mobile + v.other + (v.car ? v.carCost + v.carBenefit * EMPLOYER_FEE : 0);
  const available = revenue - v.savings;
  let salary = 0;
  for (let s = 1000; s <= available; s += 100) {
    if (fixed + s * SALARY_COST <= available) salary = s; else break;
  }
  const salaryCost = salary * SALARY_COST;
  return {
    revenue, salary, base: salary, employer: salary * EMPLOYER_FEE, holiday: salary * HOLIDAY, pension: salary * PENSION,
    pensionTax: salary * PENSION * PENSION_TAX, salaryCost, fixed, costs: fixed + salaryCost, balance: revenue - fixed - salaryCost,
  };
}

const ZERO = { rate: 0, hours: 0, share: 70, health: 0, mobile: 0, other: 0, savings: 0, car: false, carCost: 0, carBenefit: 0 };
const CASES = [
  ['a rate and hours only', { rate: 1000, hours: 160 }],
  ['the lowest share', { rate: 950, hours: 168, share: 70 }],
  ['the highest share, with costs and savings', { rate: 1250, hours: 152, share: 80, health: 600, mobile: 399, other: 1500, savings: 10000 }],
  ['a company car', { rate: 1100, hours: 160, share: 76, health: 500, car: true, carCost: 6500, carBenefit: 4200 }],
  ['an exact boundary (157,000 carries 100,000)', { rate: 1962.5, hours: 100, share: 80 }],
  ['costs above the share', { rate: 100, hours: 10, share: 75, other: 5000 }],
  ['a share just under the smallest salary', { rate: 10, hours: 200, share: 75 }],
  ['fractions', { rate: 987.5, hours: 137.5, share: 73, mobile: 249.5, savings: 2500 }],
];

const ID = { rate: 'calc-rate', hours: 'calc-hours', health: 'calc-health', mobile: 'calc-mobile', other: 'calc-other', savings: 'calc-savings', carCost: 'calc-car-cost', carBenefit: 'calc-car-benefit' };
const FIGURES = ['revenue', 'salary', 'base', 'employer', 'holiday', 'pension', 'pensionTax', 'salaryCost', 'fixed', 'costs', 'balance'];
const LINES = ['base', 'employer', 'holiday', 'pension', 'pensionTax', 'otherSalary'];

// "52,300 SEK" or "−1,200 SEK" as a number; NaN when the text is anything else.
const parse = (t) => (/^−?\d{1,3}(,\d{3})* SEK$/.test(t) ? Number(t.replace('−', '-').replace(/,| SEK/g, '')) : NaN);

async function enter(page, v) {
  for (const [key, id] of Object.entries(ID)) {
    if ((key === 'carCost' || key === 'carBenefit') && !v.car) continue;         // hidden, so not typed into
    await page.fill('#' + id, v[key] ? String(v[key]) : '');
  }
  await page.evaluate((share) => {
    const el = document.getElementById('calc-share');
    el.value = String(share);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v.share);
}
const read = (page) => page.evaluate(() => {
  const out = {};
  for (const el of document.querySelectorAll('[data-calc-out]')) out[el.getAttribute('data-calc-out')] = el.textContent;
  return out;
});

(async () => {
  console.log(scopeLine('root', ['membership.html'], { feature: 'the page the rate calculator is on' }));
  const browser = await launch();
  let problems = 0;
  const check = (ok, name, detail) => {
    if (!ok) problems++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  };
  const url = `${BASE}membership.html`;

  // 1. With JavaScript: the calculator is shown, the fallback is not, and every figure starts at zero.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  {
    const s = await page.evaluate(() => ({
      cls: document.documentElement.className,
      calc: getComputedStyle(document.querySelector('.calc')).display,
      nojs: getComputedStyle(document.querySelector('.calc-nojs')).display,
      car: getComputedStyle(document.getElementById('calc-car-fields')).display,
      unlabelled: [...document.querySelectorAll('.calc input')].filter((i) => !i.labels || !i.labels.length).map((i) => i.id),
    }));
    check(/\bjs-calc\b/.test(s.cls) && s.calc === 'grid' && s.nojs === 'none', 'with JavaScript the calculator is shown and the no-JavaScript paragraph is not', `html class "${s.cls}", .calc ${s.calc}, .calc-nojs ${s.nojs}`);
    check(s.car === 'none', 'the car fields are not shown until Company car is ticked', `display ${s.car}`);
    check(s.unlabelled.length === 0, 'every field of the calculator has a label', s.unlabelled.join(', '));
    const got = await read(page);
    const nonZero = FIGURES.concat('otherSalary').filter((k) => got[k] !== '0 SEK');
    check(nonZero.length === 0, 'an empty calculator shows 0 SEK on every line', nonZero.map((k) => `${k}: ${got[k]}`).join(', '));
  }

  // 1b. The share: 70 per cent with its slider out of sight, held there whatever the hidden slider is set to, and
  // shown only by five quick clicks on the first title, which nothing on the page gives away.
  {
    const shareShown = () => page.evaluate(() => { const f = document.querySelector('[data-calc-share]'); return !f.hidden && getComputedStyle(f).display !== 'none'; });
    const at70 = Object.assign({}, ZERO, { rate: 1000, hours: 160 });
    await page.fill('#calc-rate', '1000');
    await page.fill('#calc-hours', '160');
    const first = await read(page);
    check(!(await shareShown()) && first.shareLabel === '70%' && parse(first.revenue) === expected(at70).revenue && parse(first.salary) === expected(at70).salary,
      'on arrival the share slider is not shown and the figures use 70 per cent', `shown ${await shareShown()}, label ${first.shareLabel}, share ${first.revenue}`);
    await page.evaluate(() => { const el = document.getElementById('calc-share'); el.value = '80'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const forced = await read(page);
    const value = await page.evaluate(() => document.getElementById('calc-share').value);
    check(value === '70' && parse(forced.revenue) === expected(at70).revenue, 'while it is hidden the slider cannot move the share off 70 per cent (a restored form, a script)', `value ${value}, share ${forced.revenue}`);
    const hint = await page.evaluate(() => {
      const t = document.querySelector('[data-calc-reveal]');
      const attrs = [...t.attributes].map((a) => a.name).filter((n) => !['class', 'data-calc-reveal'].includes(n));
      const words = /\b(click|clicks|tap|press|times|hidden|secret|unlock)\b/i.test(document.querySelector('#rate-calculator').textContent);
      return { tag: t.tagName, attrs, cursor: getComputedStyle(t).cursor, focusable: t.tabIndex >= 0, words };
    });
    check(hint.attrs.length === 0 && !/pointer/.test(hint.cursor) && !hint.focusable && !hint.words, 'nothing hints at the hidden slider: the title has no tooltip, role, tab stop or pointer cursor, and the section does not mention it', JSON.stringify(hint));
    const title = page.locator('[data-calc-reveal]');
    for (let i = 0; i < 4; i++) await title.click();
    const afterFour = await shareShown();
    await page.waitForTimeout(2300);                                             // longer than the gap app.js allows
    for (let i = 0; i < 4; i++) await title.click();
    const afterSlow = await shareShown();
    check(!afterFour && !afterSlow, 'four clicks on the title do not show the slider, and clicks either side of a pause do not add up', `after four ${afterFour}, after four more ${afterSlow}`);
    await title.click();
    check(await shareShown(), 'the fifth quick click on the title shows the share slider');
    const lab = await page.evaluate(() => document.getElementById('calc-share').labels.length);
    check(lab === 1, 'once shown, the slider has its label', `labels ${lab}`);
  }

  // 2. Every case: each figure is the model's, and the cost lines add up to the total salary cost.
  for (const [name, partial] of CASES) {
    const v = Object.assign({}, ZERO, partial);
    if ((await page.isChecked('#calc-car')) !== v.car) await page.click('#calc-car');
    await enter(page, v);
    const got = await read(page);
    const want = expected(v);
    const bad = FIGURES.filter((k) => parse(got[k]) !== Math.round(want[k])).map((k) => `${k}: page ${got[k]}, model ${Math.round(want[k])}`);
    check(bad.length === 0, `${name}: every figure matches the model`, bad.join(' | '));
    const sum = LINES.reduce((a, k) => a + parse(got[k]), 0);
    check(sum === parse(got.salaryCost) && parse(got.otherSalary) >= 0, `${name}: the cost lines add up to the total salary cost`, `lines ${sum}, total ${got.salaryCost}, other ${got.otherSalary}`);
    const shortShown = await page.evaluate(() => !document.querySelector('[data-calc-out="short"]').hidden);
    check(shortShown === (want.revenue > 0 && want.salary === 0), `${name}: the "no salary fits" line is shown only when a share carries no salary`, `shown ${shortShown}`);
    const label = await page.evaluate(() => [document.querySelector('[data-calc-out="shareLabel"]').textContent, document.getElementById('calc-share').getAttribute('aria-valuetext')]);
    check(label[0] === `${v.share}%` && label[1] === `${v.share} per cent`, `${name}: the share reads ${v.share}% beside the slider and to a screen reader`, label.join(' / '));
  }

  // 3. The car: its figures count while the box is ticked and stop counting when it is cleared.
  {
    const v = Object.assign({}, ZERO, { rate: 1100, hours: 160, car: true, carCost: 6000, carBenefit: 4000 });
    if (!(await page.isChecked('#calc-car'))) await page.click('#calc-car');
    await enter(page, v);
    const withCar = await read(page);
    const shown = await page.evaluate(() => getComputedStyle(document.getElementById('calc-car-fields')).display);
    await page.click('#calc-car');
    const without = await read(page);
    const hidden = await page.evaluate(() => getComputedStyle(document.getElementById('calc-car-fields')).display);
    check(shown !== 'none' && hidden === 'none', 'ticking Company car shows its two fields and clearing it hides them', `ticked ${shown}, cleared ${hidden}`);
    check(parse(withCar.fixed) === Math.round(6000 + 4000 * EMPLOYER_FEE) && parse(without.fixed) === 0, 'the car counts only while the box is ticked', `ticked ${withCar.fixed}, cleared ${without.fixed}`);
  }

  // 4. Figures that are not figures: negative and absurd input leaves finite, well-formed results.
  {
    await enter(page, Object.assign({}, ZERO, { rate: 1000, hours: 160 }));
    await page.fill('#calc-other', '-5000');
    const neg = await read(page);
    check(parse(neg.fixed) === 0 && parse(neg.salary) === expected(Object.assign({}, ZERO, { rate: 1000, hours: 160 })).salary, 'a negative cost counts as nothing', `fixed ${neg.fixed}, salary ${neg.salary}`);
    await page.fill('#calc-other', '');
    await page.fill('#calc-rate', '1e300');
    await page.fill('#calc-hours', '1e300');
    const huge = await read(page);
    const malformed = FIGURES.concat('otherSalary').filter((k) => Number.isNaN(parse(huge[k])));
    check(malformed.length === 0, 'an absurd rate still gives well-formed figures', malformed.map((k) => `${k}: ${huge[k]}`).join(', '));
  }

  // 5. The result is announced once typing stops, and nothing is stored.
  {
    await enter(page, Object.assign({}, ZERO, { rate: 1000, hours: 160 }));
    const want = expected(Object.assign({}, ZERO, { rate: 1000, hours: 160 }));
    await page.waitForFunction(() => /Gross monthly salary [\d,]+ SEK/.test(document.querySelector('[data-calc-out="status"]').textContent), null, { timeout: 5000 }).catch(() => {});
    const status = await page.evaluate(() => { const el = document.querySelector('[data-calc-out="status"]'); return [el.getAttribute('role'), el.textContent]; });
    check(status[0] === 'status' && status[1].includes(`Gross monthly salary ${want.salary.toLocaleString('en-GB')} SEK`), 'the salary is announced in a status region once typing stops', status.join(': '));
    const stored = await page.evaluate(() => { try { return Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter((k) => /calc|rate|salary/i.test(k)); } catch (e) { return ['blocked']; } });
    const cookies = await ctx.cookies();
    check(stored.length === 0 && cookies.length === 0, 'the calculator stores nothing: no storage key and no cookie', `keys ${stored.join(', ') || 'none'}, cookies ${cookies.length}`);
    check(errors.length === 0, 'no script error and no console error while the calculator was used', errors.slice(0, 3).join(' | '));
  }
  await ctx.close();

  // 6. Layout: two columns on a desktop, one on a phone, and the page never scrolls sideways.
  for (const [w, h, cols] of [[1280, 900, 2], [390, 844, 1], [320, 640, 1]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h } });
    const p = await c.newPage();
    await p.goto(url, { waitUntil: 'load' });
    await p.fill('#calc-rate', '1250');
    await p.fill('#calc-hours', '9999999');                                     // the longest figures the card can hold
    await p.click('#calc-car');
    const m = await p.evaluate(() => {
      const a = document.querySelector('.calc__inputs').getBoundingClientRect();
      const b = document.querySelector('.calc__results').getBoundingClientRect();
      const card = document.querySelector('.calc__results');
      const small = [...document.querySelectorAll('.calc input')].filter((i) => { const r = i.getBoundingClientRect(); return r.width > 0 && (i.type === 'checkbox' ? i.closest('label').getBoundingClientRect().height : r.height) < 44; }).map((i) => i.id);
      return { side: b.left >= a.right - 1, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, cardOverflow: card.scrollWidth - card.clientWidth, small };
    });
    check((cols === 2) === m.side, `at ${w}px the form and the results sit in ${cols === 2 ? 'two columns' : 'one column'}`, `side by side ${m.side}`);
    check(m.overflow <= 0 && m.cardOverflow <= 0, `at ${w}px nothing overflows sideways, even with very long figures`, `page ${m.overflow}px, card ${m.cardOverflow}px`);
    check(m.small.length === 0, `at ${w}px every control is at least 44px tall`, m.small.join(', '));
    await c.close();
  }

  // 7. Without JavaScript: no calculator, no dead control, and the page says why.
  {
    const c = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
    const p = await c.newPage();
    await p.goto(url, { waitUntil: 'load' });
    const vis = await p.locator('.calc').isVisible();
    const controls = await p.locator('.calc input').evaluateAll((els) => els.filter((e) => e.getClientRects().length).length);
    const note = await p.locator('.calc-nojs').isVisible();
    const link = await p.locator('.calc-nojs a').getAttribute('href');
    check(!vis && controls === 0, 'without JavaScript the calculator and its controls are not shown', `visible ${vis}, controls on screen ${controls}`);
    check(note && link === 'contact.html', 'without JavaScript the page says the calculator needs it and links to the contact page', `shown ${note}, link ${link}`);
    await c.close();
  }

  await browser.close();
  console.log(problems ? `\n${problems} problem(s)` : '\nrate calculator: all checks pass');
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
