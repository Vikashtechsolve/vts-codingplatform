import { normalizeJsonWriteData } from './jsonWriteBody.js';

describe('normalizeJsonWriteData', () => {
  test('turns null/undefined POST bodies into empty objects', () => {
    expect(normalizeJsonWriteData(null, 'post')).toEqual({});
    expect(normalizeJsonWriteData(undefined, 'POST')).toEqual({});
  });

  test('leaves real payloads and GET data alone', () => {
    const body = { courseId: 'c1' };
    expect(normalizeJsonWriteData(body, 'post')).toBe(body);
    expect(normalizeJsonWriteData(null, 'get')).toBe(null);
  });

  test('does not wrap FormData', () => {
    const form = new FormData();
    form.append('audio', 'x');
    expect(normalizeJsonWriteData(form, 'post')).toBe(form);
  });

  test('turns JSON primitives into empty objects', () => {
    expect(normalizeJsonWriteData(true, 'put')).toEqual({});
    expect(normalizeJsonWriteData('null', 'patch')).toEqual({});
  });
});
