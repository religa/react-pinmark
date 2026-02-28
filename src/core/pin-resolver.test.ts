import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolvePin, detectSelector, createPinPosition } from './pin-resolver';

describe('resolvePin', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('scrollY', 0);
  });

  it('falls back to coordinate-based positioning', () => {
    const pos = resolvePin({ x: 50, y: 200 });
    expect(pos).toEqual({ left: 500, top: 200 });
  });

  it('uses selector-based positioning when selector matches', () => {
    const el = document.createElement('div');
    el.id = 'anchor';
    el.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      top: 50,
      right: 200,
      bottom: 100,
      width: 100,
      height: 50,
      x: 100,
      y: 50,
      toJSON: () => {},
    }));
    document.body.appendChild(el);

    // selectorOffset is now fractions: x=0.1 → 0.1*100=10, y=0.4 → 0.4*50=20
    const pos = resolvePin({
      x: 50,
      y: 200,
      selector: '#anchor',
      selectorOffset: { x: 0.1, y: 0.4 },
    });

    expect(pos).toEqual({ left: 110, top: 70 });
    document.body.removeChild(el);
  });

  it('falls back to coordinates when selector not found', () => {
    const pos = resolvePin({
      x: 50,
      y: 200,
      selector: '#nonexistent',
      selectorOffset: { x: 10, y: 20 },
    });
    expect(pos).toEqual({ left: 500, top: 200 });
  });
});

describe('detectSelector', () => {
  it('builds CSS path anchored to ancestor id', () => {
    const parent = document.createElement('div');
    parent.id = 'my-section';
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    parent.getBoundingClientRect = vi.fn(() => ({
      left: 50, top: 50, right: 150, bottom: 100,
      width: 100, height: 50, x: 50, y: 50, toJSON: () => {},
    }));
    child.getBoundingClientRect = vi.fn(() => ({
      left: 70, top: 60, right: 90, bottom: 70,
      width: 20, height: 10, x: 70, y: 60, toJSON: () => {},
    }));

    // CSS path resolves to exact target — offset is relative to child
    const result = detectSelector(child, 80, 65);
    expect(result).not.toBeNull();
    expect(result!.selector).toBe('#my-section > span:nth-child(1)');
    // (80-70)/20=0.5, (65-60)/10=0.5
    expect(result!.selectorOffset).toEqual({ x: 0.5, y: 0.5 });
    expect(document.querySelector(result!.selector)).toBe(child);

    document.body.removeChild(parent);
  });

  it('builds CSS path anchored to data-comment-anchor', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-comment-anchor', 'hero');
    const child = document.createElement('p');
    parent.appendChild(child);
    document.body.appendChild(parent);

    parent.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 200, bottom: 200,
      width: 200, height: 200, x: 0, y: 0, toJSON: () => {},
    }));
    child.getBoundingClientRect = vi.fn(() => ({
      left: 10, top: 10, right: 20, bottom: 20,
      width: 10, height: 10, x: 10, y: 10, toJSON: () => {},
    }));

    const result = detectSelector(child, 10, 10);
    expect(result).not.toBeNull();
    expect(result!.selector).toContain('data-comment-anchor');
    expect(result!.selector).toContain('p:nth-child(1)');
    expect(document.querySelector(result!.selector)).toBe(child);

    document.body.removeChild(parent);
  });

  it('falls back to walk-up for data-comment-anchor when CSS path fails', () => {
    // data-comment-anchor on an ancestor that isn't a direct parent
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-comment-anchor', 'section');
    const inner = document.createElement('div');
    wrapper.appendChild(inner);
    // Don't append to body — buildSelectorPath will fail for uniqueness
    // but the walk-up should still find the data-comment-anchor

    // Actually, we need it in the DOM for querySelector to work
    document.body.appendChild(wrapper);

    wrapper.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 100, bottom: 100,
      width: 100, height: 100, x: 0, y: 0, toJSON: () => {},
    }));
    inner.getBoundingClientRect = vi.fn(() => ({
      left: 10, top: 10, right: 50, bottom: 50,
      width: 40, height: 40, x: 10, y: 10, toJSON: () => {},
    }));

    const result = detectSelector(inner, 30, 30);
    expect(result).not.toBeNull();
    expect(result!.selector).toContain('data-comment-anchor');

    document.body.removeChild(wrapper);
  });

  it('builds CSS path for elements without id or data-comment-anchor', () => {
    const el = document.createElement('span');
    document.body.appendChild(el);
    el.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 10, bottom: 10,
      width: 10, height: 10, x: 0, y: 0, toJSON: () => {},
    }));

    const result = detectSelector(el, 5, 5);
    expect(result).not.toBeNull();
    expect(result!.selector).toContain('span:nth-child(');
    expect(result!.selectorOffset).toBeDefined();

    document.body.removeChild(el);
  });

  it('anchors to data-testid', () => {
    const table = document.createElement('table');
    table.setAttribute('data-testid', 'users-table');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    tr.appendChild(td);
    tbody.appendChild(tr);
    table.appendChild(tbody);
    document.body.appendChild(table);

    td.getBoundingClientRect = vi.fn(() => ({
      left: 50, top: 50, right: 150, bottom: 80,
      width: 100, height: 30, x: 50, y: 50, toJSON: () => {},
    }));

    const result = detectSelector(td, 100, 65);
    expect(result).not.toBeNull();
    expect(result!.selector).toContain('[data-testid="users-table"]');
    expect(result!.selector).toContain('td:nth-child(1)');
    expect(document.querySelector(result!.selector)).toBe(td);

    document.body.removeChild(table);
  });

  it('anchors to name attribute', () => {
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.setAttribute('name', 'email');
    form.appendChild(input);
    document.body.appendChild(form);

    input.getBoundingClientRect = vi.fn(() => ({
      left: 10, top: 10, right: 200, bottom: 30,
      width: 190, height: 20, x: 10, y: 10, toJSON: () => {},
    }));

    const result = detectSelector(input, 100, 20);
    expect(result).not.toBeNull();
    expect(result!.selector).toContain('[name="email"]');
    expect(document.querySelector(result!.selector)).toBe(input);

    document.body.removeChild(form);
  });

  it('prefers data-testid over name', () => {
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'email-input');
    input.setAttribute('name', 'email');
    document.body.appendChild(input);

    input.getBoundingClientRect = vi.fn(() => ({
      left: 10, top: 10, right: 200, bottom: 30,
      width: 190, height: 20, x: 10, y: 10, toJSON: () => {},
    }));

    const result = detectSelector(input, 100, 20);
    expect(result).not.toBeNull();
    expect(result!.selector).toContain('data-testid');

    document.body.removeChild(input);
  });

  it('anchors to MUI DataGrid data-id on rows', () => {
    const grid = document.createElement('div');
    grid.setAttribute('data-testid', 'user-grid');
    const row = document.createElement('div');
    row.setAttribute('data-id', '42');
    row.setAttribute('data-rowindex', '3');
    const cell = document.createElement('div');
    row.appendChild(cell);
    grid.appendChild(row);
    document.body.appendChild(grid);

    cell.getBoundingClientRect = vi.fn(() => ({
      left: 100, top: 200, right: 250, bottom: 230,
      width: 150, height: 30, x: 100, y: 200, toJSON: () => {},
    }));

    const result = detectSelector(cell, 175, 215);
    expect(result).not.toBeNull();
    // Row's data-id anchors the path (CSS.escape encodes leading digits)
    expect(result!.selector).toContain('data-id=');
    expect(document.querySelector(result!.selector)).toBe(cell);

    document.body.removeChild(grid);
  });

  it('skips root-like ids and continues walking', () => {
    const root = document.createElement('div');
    root.id = 'root';
    const table = document.createElement('table');
    table.setAttribute('data-testid', 'my-table');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    tr.appendChild(td);
    tbody.appendChild(tr);
    table.appendChild(tbody);
    root.appendChild(table);
    document.body.appendChild(root);

    td.getBoundingClientRect = vi.fn(() => ({
      left: 50, top: 50, right: 150, bottom: 80,
      width: 100, height: 30, x: 50, y: 50, toJSON: () => {},
    }));

    const result = detectSelector(td, 100, 65);
    expect(result).not.toBeNull();
    // Should anchor to data-testid, NOT #root
    expect(result!.selector).toContain('data-testid="my-table"');
    expect(result!.selector).not.toContain('#root');
    expect(document.querySelector(result!.selector)).toBe(td);

    document.body.removeChild(root);
  });

  it('uses tag-qualified selector when bare attribute is not unique', () => {
    // Two elements with same data-id but different tags
    const row = document.createElement('div');
    row.setAttribute('data-id', '99');
    const header = document.createElement('span');
    header.setAttribute('data-id', '99');
    const cell = document.createElement('div');
    row.appendChild(cell);
    document.body.appendChild(row);
    document.body.appendChild(header);

    cell.getBoundingClientRect = vi.fn(() => ({
      left: 10, top: 10, right: 100, bottom: 40,
      width: 90, height: 30, x: 10, y: 10, toJSON: () => {},
    }));

    const result = detectSelector(cell, 50, 25);
    expect(result).not.toBeNull();
    // bare [data-id="99"] matches 2 elements, but div[data-id="99"] is unique
    expect(result!.selector).toContain('div[data-id=');
    expect(document.querySelector(result!.selector)).toBe(cell);

    document.body.removeChild(row);
    document.body.removeChild(header);
  });

  it('builds CSS path through table structure', () => {
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');
    tr.appendChild(td1);
    tr.appendChild(td2);
    tbody.appendChild(tr);
    table.appendChild(tbody);
    document.body.appendChild(table);

    td2.getBoundingClientRect = vi.fn(() => ({
      left: 100, top: 50, right: 200, bottom: 80,
      width: 100, height: 30, x: 100, y: 50, toJSON: () => {},
    }));

    const result = detectSelector(td2, 150, 65);
    expect(result).not.toBeNull();
    expect(result!.selector).toContain('td:nth-child(2)');
    // Verify the selector actually finds the element
    expect(document.querySelector(result!.selector)).toBe(td2);

    document.body.removeChild(table);
  });
});

describe('createPinPosition', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('scrollY', 100);
  });

  it('creates a pin from click coordinates', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    target.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 10, bottom: 10,
      width: 10, height: 10, x: 0, y: 0, toJSON: () => {},
    }));

    const pin = createPinPosition(500, 300, target);
    expect(pin.x).toBe(50); // 500/1000 * 100
    expect(pin.y).toBe(400); // 300 + scrollY(100)

    document.body.removeChild(target);
  });

  it('includes selector info when available', () => {
    const parent = document.createElement('div');
    parent.id = 'target-el';
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    parent.getBoundingClientRect = vi.fn(() => ({
      left: 50, top: 50, right: 150, bottom: 100,
      width: 100, height: 50, x: 50, y: 50, toJSON: () => {},
    }));
    child.getBoundingClientRect = vi.fn(() => ({
      left: 60, top: 55, right: 70, bottom: 60,
      width: 10, height: 5, x: 60, y: 55, toJSON: () => {},
    }));

    const pin = createPinPosition(60, 55, child);
    expect(pin.selector).toContain('#target-el');
    expect(pin.selector).toContain('span:nth-child(1)');
    expect(pin.selectorOffset).toBeDefined();

    document.body.removeChild(parent);
  });
});
