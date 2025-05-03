import { formatCurrency } from '../../lib/stripe';

describe('Stripe utilities', () => {
  describe('formatCurrency', () => {
    it('formats USD currency correctly', () => {
      expect(formatCurrency(1000)).toBe('$10.00');
      expect(formatCurrency(1250)).toBe('$12.50');
      expect(formatCurrency(999)).toBe('$9.99');
    });

    it('handles zero amounts', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('formats other currencies when specified', () => {
      expect(formatCurrency(1000, 'eur')).toBe('€10.00');
      expect(formatCurrency(1000, 'gbp')).toBe('£10.00');
    });
  });
});