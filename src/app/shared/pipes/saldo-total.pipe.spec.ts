import { SaldoTotalPipe } from './saldo-total.pipe';
import { ClienteModel } from '../../model/cliente.model';

describe('SaldoTotalPipe', () => {
  let pipe: SaldoTotalPipe;

  beforeEach(() => {
    pipe = new SaldoTotalPipe();
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  describe('transform', () => {
    it('should return 0 for null input', () => {
      const result = pipe.transform(null);
      expect(result).toBe(0);
    });

    it('should return 0 for undefined input', () => {
      const result = pipe.transform(undefined);
      expect(result).toBe(0);
    });

    it('should return 0 for empty array', () => {
      const result = pipe.transform([]);
      expect(result).toBe(0);
    });

    it('should return 0 for non-array input', () => {
      const result = pipe.transform('not an array' as any);
      expect(result).toBe(0);
    });

    it('should calculate total for single client', () => {
      const clientes: ClienteModel[] = [
        { id: '1', nombre: 'Juan', apellido: 'Pérez', saldo: 1000 }
      ];
      
      const result = pipe.transform(clientes);
      expect(result).toBe(1000);
    });

    it('should calculate total for multiple clients', () => {
      const clientes: ClienteModel[] = [
        { id: '1', nombre: 'Juan', apellido: 'Pérez', saldo: 1000 },
        { id: '2', nombre: 'María', apellido: 'González', saldo: 2000 },
        { id: '3', nombre: 'Carlos', apellido: 'López', saldo: 500 }
      ];
      
      const result = pipe.transform(clientes);
      expect(result).toBe(3500);
    });

    it('should handle negative balances', () => {
      const clientes: ClienteModel[] = [
        { id: '1', nombre: 'Juan', apellido: 'Pérez', saldo: 1000 },
        { id: '2', nombre: 'María', apellido: 'González', saldo: -500 },
        { id: '3', nombre: 'Carlos', apellido: 'López', saldo: 300 }
      ];
      
      const result = pipe.transform(clientes);
      expect(result).toBe(800);
    });

    it('should handle zero balances', () => {
      const clientes: ClienteModel[] = [
        { id: '1', nombre: 'Juan', apellido: 'Pérez', saldo: 0 },
        { id: '2', nombre: 'María', apellido: 'González', saldo: 1000 }
      ];
      
      const result = pipe.transform(clientes);
      expect(result).toBe(1000);
    });

    it('should handle undefined saldo values', () => {
      const clientes: ClienteModel[] = [
        { id: '1', nombre: 'Juan', apellido: 'Pérez', saldo: undefined },
        { id: '2', nombre: 'María', apellido: 'González', saldo: 1000 },
        { id: '3', nombre: 'Carlos', apellido: 'López', saldo: null as any }
      ];
      
      const result = pipe.transform(clientes);
      expect(result).toBe(1000); // Only valid saldo should be counted
    });

    it('should handle decimal balances', () => {
      const clientes: ClienteModel[] = [
        { id: '1', nombre: 'Juan', apellido: 'Pérez', saldo: 1000.50 },
        { id: '2', nombre: 'María', apellido: 'González', saldo: 2000.25 },
        { id: '3', nombre: 'Carlos', apellido: 'López', saldo: 500.75 }
      ];
      
      const result = pipe.transform(clientes);
      expect(result).toBe(3501.50);
    });

    it('should be performant with large datasets', () => {
      const largeClientList: ClienteModel[] = Array.from({ length: 10000 }, (_, i) => ({
        id: `client-${i}`,
        nombre: `Cliente ${i}`,
        apellido: 'Test',
        saldo: Math.random() * 1000
      }));

      const startTime = performance.now();
      const result = pipe.transform(largeClientList);
      const endTime = performance.now();

      expect(result).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10); // Should complete in less than 10ms
    });

    it('should be a pure pipe (same input should return same output)', () => {
      const clientes: ClienteModel[] = [
        { id: '1', nombre: 'Juan', apellido: 'Pérez', saldo: 1000 },
        { id: '2', nombre: 'María', apellido: 'González', saldo: 2000 }
      ];

      const result1 = pipe.transform(clientes);
      const result2 = pipe.transform(clientes);

      expect(result1).toBe(result2);
      expect(result1).toBe(3000);
    });

    it('should handle mixed data types gracefully', () => {
      const clientes: any[] = [
        { id: '1', nombre: 'Juan', apellido: 'Pérez', saldo: 1000 },
        { id: '2', nombre: 'María', apellido: 'González', saldo: '2000' }, // String
        { id: '3', nombre: 'Carlos', apellido: 'López', saldo: true }, // Boolean
        { id: '4', nombre: 'Ana', apellido: 'Ruiz', saldo: 500 }
      ];

      const result = pipe.transform(clientes);
      
      // Should handle type coercion: 1000 + 2000 (string to number) + 1 (boolean) + 500 = 3501
      expect(result).toBe(3501);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should maintain consistent performance across multiple calls', () => {
      const clientes: ClienteModel[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `client-${i}`,
        nombre: `Cliente ${i}`,
        apellido: 'Test',
        saldo: i * 10
      }));

      const times: number[] = [];
      
      // Run multiple iterations
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        pipe.transform(clientes);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(averageTime).toBeLessThan(2); // Average should be less than 2ms
      expect(maxTime).toBeLessThan(10); // No single call should exceed 10ms
    });

    it('should have linear time complexity O(n)', () => {
      const createTestData = (size: number) => 
        Array.from({ length: size }, (_, i) => ({
          id: `client-${i}`,
          nombre: `Cliente ${i}`,
          apellido: 'Test',
          saldo: i * 10
        }));

      // Test with different sizes
      const sizes = [100, 500, 1000, 5000];
      const times: number[] = [];

      sizes.forEach(size => {
        const testData = createTestData(size);
        const startTime = performance.now();
        pipe.transform(testData);
        const endTime = performance.now();
        times.push(endTime - startTime);
      });

      // Verify that time complexity is roughly linear
      // Time should scale proportionally with input size
      const timeRatio = times[3] / times[0]; // 5000 vs 100 items
      const sizeRatio = sizes[3] / sizes[0]; // 50x more items

      expect(timeRatio).toBeLessThan(sizeRatio * 2); // Should not be much worse than linear
    });
  });
});