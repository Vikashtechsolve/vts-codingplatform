import { buildAssessmentStartBody } from './courseAssessment.js';

describe('buildAssessmentStartBody', () => {
  test('never returns null', () => {
    expect(buildAssessmentStartBody()).toEqual({});
    expect(buildAssessmentStartBody({ courseId: 'c1' })).toEqual({});
  });

  test('includes course and contest when present', () => {
    expect(
      buildAssessmentStartBody({
        courseId: 'c1',
        moduleId: 'm1',
        contestId: 'x',
      })
    ).toEqual({ courseId: 'c1', moduleId: 'm1', contestId: 'x' });
  });
});
