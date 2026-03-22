import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureContext, captureTargetInfo, captureSurroundingText, findNearbyLabel } from './context-capture';

describe('captureContext', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 720);
    vi.stubGlobal('navigator', { userAgent: 'TestAgent/1.0' });
  });

  it('captures viewport, userAgent, and timestamp', () => {
    const ctx = captureContext();
    expect(ctx.viewport).toEqual({ width: 1280, height: 720 });
    expect(ctx.userAgent).toBe('TestAgent/1.0');
    expect(ctx.timestamp).toBeTruthy();
    expect(() => new Date(ctx.timestamp)).not.toThrow();
    expect(ctx.custom).toBeUndefined();
  });

  it('includes custom context when provider is given', () => {
    const ctx = captureContext(() => ({ buildId: '123', env: 'staging' }));
    expect(ctx.custom).toEqual({ buildId: '123', env: 'staging' });
  });

  it('includes pageTitle when document.title is set', () => {
    Object.defineProperty(document, 'title', { value: 'My Page', writable: true, configurable: true });
    const ctx = captureContext();
    expect(ctx.pageTitle).toBe('My Page');
  });

  it('omits pageTitle when document.title is empty', () => {
    Object.defineProperty(document, 'title', { value: '', writable: true, configurable: true });
    const ctx = captureContext();
    expect(ctx.pageTitle).toBeUndefined();
  });

  it('includes targetElement when targetInfo is provided', () => {
    const info = { text: 'Skierowanie', tagName: 'h6', attributes: { id: 'heading' } };
    const ctx = captureContext(undefined, info);
    expect(ctx.targetElement).toBeDefined();
    expect(ctx.targetElement!.text).toBe('Skierowanie');
    expect(ctx.targetElement!.tagName).toBe('h6');
  });

  it('omits targetElement when not provided', () => {
    const ctx = captureContext();
    expect(ctx.targetElement).toBeUndefined();
  });
});

describe('captureTargetInfo', () => {
  it('extracts text and attributes from element', () => {
    const el = document.createElement('button');
    el.textContent = 'Click me';
    el.setAttribute('data-testid', 'submit-btn');
    el.setAttribute('aria-label', 'Submit form');

    const info = captureTargetInfo(el);
    expect(info.text).toBe('Click me');
    expect(info.tagName).toBe('button');
    expect(info.attributes).toEqual({
      'data-testid': 'submit-btn',
      'aria-label': 'Submit form',
    });
  });

  it('walks up to parent when target has no meaningful attributes', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-testid', 'form-section');
    const child = document.createElement('span');
    child.textContent = 'Label';
    parent.appendChild(child);
    document.body.appendChild(parent);

    const info = captureTargetInfo(child);
    expect(info.text).toBe('Label');
    expect(info.tagName).toBe('span');
    expect(info.attributes).toEqual({ 'parent_data-testid': 'form-section' });

    document.body.removeChild(parent);
  });

  it('truncates text to 200 chars', () => {
    const el = document.createElement('p');
    el.textContent = 'A'.repeat(300);

    const info = captureTargetInfo(el);
    expect(info.text).toHaveLength(200);
  });

  it('returns empty attributes when no meaningful attrs found', () => {
    const el = document.createElement('div');
    el.textContent = 'plain';

    const info = captureTargetInfo(el);
    expect(info.attributes).toEqual({});
  });

  it('captures width and height from getBoundingClientRect', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 120, bottom: 40,
      width: 120, height: 40, x: 0, y: 0, toJSON: () => {},
    }));

    const info = captureTargetInfo(el);
    expect(info.dimensions).toEqual({ width: 120, height: 40 });
  });

  it('dimensions is undefined for zero-size elements', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 0, bottom: 0,
      width: 0, height: 0, x: 0, y: 0, toJSON: () => {},
    }));

    const info = captureTargetInfo(el);
    expect(info.dimensions).toBeUndefined();
  });

  it('isDisabled is true for <button disabled>', () => {
    const el = document.createElement('button');
    el.disabled = true;

    const info = captureTargetInfo(el);
    expect(info.isDisabled).toBe(true);
  });

  it('isDisabled is true for aria-disabled="true"', () => {
    const el = document.createElement('div');
    el.setAttribute('aria-disabled', 'true');

    const info = captureTargetInfo(el);
    expect(info.isDisabled).toBe(true);
  });

  it('isDisabled is undefined for enabled elements', () => {
    const el = document.createElement('button');

    const info = captureTargetInfo(el);
    expect(info.isDisabled).toBeUndefined();
  });

  it('isHidden is true for display: none', () => {
    const el = document.createElement('div');
    el.style.display = 'none';
    document.body.appendChild(el);

    const info = captureTargetInfo(el);
    expect(info.isHidden).toBe(true);

    document.body.removeChild(el);
  });

  it('isHidden is undefined for visible elements', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const info = captureTargetInfo(el);
    expect(info.isHidden).toBeUndefined();

    document.body.removeChild(el);
  });
});

describe('captureSurroundingText', () => {
  it('captures text before and after the target within parent', () => {
    const parent = document.createElement('p');
    const target = document.createElement('strong');
    target.textContent = 'Skierowanie';
    parent.append('Data: 2024-01-15 | ', target, ' nr 42 od dr. Kowalski');
    document.body.appendChild(parent);

    const result = captureSurroundingText(target);
    expect(result).toContain('Data: 2024-01-15 |');
    expect(result).toContain('[Skierowanie]');
    expect(result).toContain('nr 42 od dr. Kowalski');

    document.body.removeChild(parent);
  });

  it('adds ... prefix/suffix when text is truncated', () => {
    const parent = document.createElement('p');
    const longBefore = 'A'.repeat(80);
    const longAfter = 'B'.repeat(80);
    const target = document.createElement('span');
    target.textContent = 'X';
    parent.append(longBefore, target, longAfter);
    document.body.appendChild(parent);

    const result = captureSurroundingText(target);
    expect(result).toMatch(/^\.\.\./);
    expect(result).toMatch(/\.\.\.$/);

    document.body.removeChild(parent);
  });

  it('returns undefined when parent text equals element text', () => {
    const parent = document.createElement('p');
    const target = document.createElement('span');
    target.textContent = 'Only text';
    parent.appendChild(target);
    document.body.appendChild(parent);

    const result = captureSurroundingText(target);
    expect(result).toBeUndefined();

    document.body.removeChild(parent);
  });

  it('returns undefined when element has no parent or parent is body', () => {
    const el = document.createElement('div');
    el.textContent = 'Hello';
    document.body.appendChild(el);

    const result = captureSurroundingText(el);
    expect(result).toBeUndefined();

    document.body.removeChild(el);
  });

  it('brackets the element text in [...]', () => {
    const parent = document.createElement('p');
    const target = document.createElement('em');
    target.textContent = 'word';
    parent.append('before ', target, ' after');
    document.body.appendChild(parent);

    const result = captureSurroundingText(target);
    expect(result).toContain('[word]');

    document.body.removeChild(parent);
  });
});

describe('findNearbyLabel', () => {
  it('finds <label for="..."> for an input with matching id', () => {
    const label = document.createElement('label');
    label.setAttribute('for', 'qty');
    label.textContent = 'Quantity';
    const input = document.createElement('input');
    input.id = 'qty';
    document.body.appendChild(label);
    document.body.appendChild(input);

    expect(findNearbyLabel(input)).toBe('Quantity');

    document.body.removeChild(label);
    document.body.removeChild(input);
  });

  it('finds wrapping <label> text, excluding the input own text', () => {
    const label = document.createElement('label');
    label.textContent = 'Email';
    const input = document.createElement('input');
    label.appendChild(input);
    document.body.appendChild(label);

    expect(findNearbyLabel(input)).toBe('Email');

    document.body.removeChild(label);
  });

  it('resolves aria-labelledby to referenced element text', () => {
    const ref = document.createElement('span');
    ref.id = 'desc-1';
    ref.textContent = 'Description Field';
    const el = document.createElement('input');
    el.setAttribute('aria-labelledby', 'desc-1');
    document.body.appendChild(ref);
    document.body.appendChild(el);

    expect(findNearbyLabel(el)).toBe('Description Field');

    document.body.removeChild(ref);
    document.body.removeChild(el);
  });

  it('captures column header text for a <td> inside a <table> with <thead>', () => {
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const th1 = document.createElement('th');
    th1.textContent = 'Name';
    const th2 = document.createElement('th');
    th2.textContent = 'Quantity';
    headRow.appendChild(th1);
    headRow.appendChild(th2);
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = 'Widget';
    const td2 = document.createElement('td');
    td2.textContent = '42';
    row.appendChild(td1);
    row.appendChild(td2);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);

    expect(findNearbyLabel(td2)).toBe('Quantity');

    document.body.removeChild(table);
  });

  it('finds nearest preceding heading sibling', () => {
    const container = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = 'Settings';
    const target = document.createElement('p');
    target.textContent = 'Some text';
    container.appendChild(heading);
    container.appendChild(target);
    document.body.appendChild(container);

    expect(findNearbyLabel(target)).toBe('Settings');

    document.body.removeChild(container);
  });

  it('returns undefined when no label context exists', () => {
    const el = document.createElement('div');
    el.textContent = 'plain';
    document.body.appendChild(el);

    expect(findNearbyLabel(el)).toBeUndefined();

    document.body.removeChild(el);
  });

  it('truncates label text to 100 chars', () => {
    const label = document.createElement('label');
    label.setAttribute('for', 'long');
    label.textContent = 'X'.repeat(150);
    const input = document.createElement('input');
    input.id = 'long';
    document.body.appendChild(label);
    document.body.appendChild(input);

    const result = findNearbyLabel(input);
    expect(result).toHaveLength(100);

    document.body.removeChild(label);
    document.body.removeChild(input);
  });
});
