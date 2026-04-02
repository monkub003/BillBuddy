describe('Project Setup', () => {
  it('should have Jest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should have fast-check available', () => {
    const fc = require('fast-check');
    expect(fc).toBeDefined();
    expect(typeof fc.assert).toBe('function');
  });
});
