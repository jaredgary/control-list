import { Injectable } from '@angular/core';
import { Observable, Subject, fromEvent } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

export interface PerformanceMetrics {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage?: number;
  renderTime?: number;
  changeDetectionCycles?: number;
}

export interface BenchmarkResult {
  testName: string;
  iterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
  totalTime: number;
  memoryDelta?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceBenchmarkUtil {
  private metrics: PerformanceMetrics[] = [];
  private destroy$ = new Subject<void>();

  /**
   * Marca el inicio de una medición de performance
   */
  markStart(name: string): void {
    performance.mark(`${name}-start`);
    
    const metric: PerformanceMetrics = {
      name,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      memoryUsage: this.getMemoryUsage()
    };
    
    this.metrics.push(metric);
  }

  /**
   * Marca el final de una medición de performance
   */
  markEnd(name: string): PerformanceMetrics | null {
    const endTime = performance.now();
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);

    const metric = this.metrics.find(m => m.name === name && m.endTime === 0);
    if (metric) {
      metric.endTime = endTime;
      metric.duration = endTime - metric.startTime;
      
      // Calculate memory delta if available
      const currentMemory = this.getMemoryUsage();
      if (metric.memoryUsage && currentMemory) {
        metric.memoryUsage = currentMemory - metric.memoryUsage;
      }

      return metric;
    }

    return null;
  }

  /**
   * Ejecuta un benchmark de una función específica
   */
  async benchmark<T>(
    testName: string,
    fn: () => T | Promise<T>,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    const initialMemory = this.getMemoryUsage();
    
    // Warm-up round
    for (let i = 0; i < 10; i++) {
      await fn();
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await fn();
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const finalMemory = this.getMemoryUsage();
    const memoryDelta = finalMemory && initialMemory ? finalMemory - initialMemory : undefined;

    return this.calculateBenchmarkResult(testName, times, iterations, memoryDelta);
  }

  /**
   * Mide el tiempo de render de un componente
   */
  measureRenderTime(): Observable<number> {
    return new Observable(observer => {
      const startTime = performance.now();
      
      // Use requestAnimationFrame to measure actual render time
      requestAnimationFrame(() => {
        const endTime = performance.now();
        observer.next(endTime - startTime);
        observer.complete();
      });
    });
  }

  /**
   * Mide la frecuencia de frames (FPS)
   */
  measureFPS(duration: number = 5000): Observable<number> {
    return new Observable(observer => {
      let frameCount = 0;
      const startTime = performance.now();
      
      const countFrame = () => {
        frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - startTime < duration) {
          requestAnimationFrame(countFrame);
        } else {
          const fps = frameCount / (duration / 1000);
          observer.next(fps);
          observer.complete();
        }
      };

      requestAnimationFrame(countFrame);
    });
  }

  /**
   * Mide el tiempo de digest cycle de Angular
   */
  measureDigestCycle(): Promise<number> {
    return new Promise(resolve => {
      const startTime = performance.now();
      
      // Use zone.js to detect when Angular finishes change detection
      (window as any).Zone.current.runOutsideAngular(() => {
        setTimeout(() => {
          const endTime = performance.now();
          resolve(endTime - startTime);
        }, 0);
      });
    });
  }

  /**
   * Compara el performance entre dos implementaciones
   */
  async comparePerformance<T>(
    testName: string,
    oldImplementation: () => T | Promise<T>,
    newImplementation: () => T | Promise<T>,
    iterations: number = 100
  ): Promise<{
    oldResult: BenchmarkResult;
    newResult: BenchmarkResult;
    improvement: number;
    improvementPercentage: number;
  }> {
    const oldResult = await this.benchmark(`${testName}-old`, oldImplementation, iterations);
    const newResult = await this.benchmark(`${testName}-new`, newImplementation, iterations);
    
    const improvement = oldResult.averageTime - newResult.averageTime;
    const improvementPercentage = (improvement / oldResult.averageTime) * 100;

    return {
      oldResult,
      newResult,
      improvement,
      improvementPercentage
    };
  }

  /**
   * Genera un reporte de performance
   */
  generateReport(): string {
    if (this.metrics.length === 0) {
      return 'No hay métricas de performance disponibles.';
    }

    let report = '=== REPORTE DE PERFORMANCE ===\n\n';
    
    this.metrics.forEach((metric, index) => {
      report += `${index + 1}. ${metric.name}\n`;
      report += `   Duración: ${metric.duration.toFixed(2)}ms\n`;
      
      if (metric.memoryUsage) {
        report += `   Memoria: ${(metric.memoryUsage / 1024).toFixed(2)}KB\n`;
      }
      
      if (metric.renderTime) {
        report += `   Render: ${metric.renderTime.toFixed(2)}ms\n`;
      }
      
      report += '\n';
    });

    return report;
  }

  /**
   * Limpia todas las métricas
   */
  clearMetrics(): void {
    this.metrics = [];
    performance.clearMarks();
    performance.clearMeasures();
  }

  /**
   * Obtiene todas las métricas registradas
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Destruye el servicio y limpia recursos
   */
  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearMetrics();
  }

  // Private helper methods
  private getMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return undefined;
  }

  private calculateBenchmarkResult(
    testName: string,
    times: number[],
    iterations: number,
    memoryDelta?: number
  ): BenchmarkResult {
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    // Calculate standard deviation
    const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / iterations;
    const standardDeviation = Math.sqrt(variance);

    return {
      testName,
      iterations,
      averageTime,
      minTime,
      maxTime,
      standardDeviation,
      totalTime,
      memoryDelta
    };
  }
}

// Decorator for automatic performance measurement
export function Benchmark(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const methodName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = function (...args: any[]) {
      const benchmarkUtil = new PerformanceBenchmarkUtil();
      benchmarkUtil.markStart(methodName);
      
      const result = originalMethod.apply(this, args);
      
      if (result && typeof result.then === 'function') {
        // Handle Promise
        return result.then((res: any) => {
          benchmarkUtil.markEnd(methodName);
          return res;
        });
      } else {
        benchmarkUtil.markEnd(methodName);
        return result;
      }
    };

    return descriptor;
  };
}

// Utility functions for specific Angular performance measurements
export class AngularPerformanceUtils {
  
  /**
   * Mide el tiempo de inicialización de un componente
   */
  static measureComponentInit(componentClass: any): Promise<number> {
    return new Promise(resolve => {
      const startTime = performance.now();
      
      // Simulate component initialization
      const instance = new componentClass();
      if (instance.ngOnInit) {
        instance.ngOnInit();
      }
      
      requestAnimationFrame(() => {
        const endTime = performance.now();
        resolve(endTime - startTime);
      });
    });
  }

  /**
   * Mide el impacto de OnPush vs Default change detection
   */
  static async compareChangeDetectionStrategies(
    defaultComponent: any,
    onPushComponent: any,
    iterations: number = 50
  ): Promise<{
    defaultTime: number;
    onPushTime: number;
    improvement: number;
  }> {
    const benchmarkUtil = new PerformanceBenchmarkUtil();
    
    const defaultResult = await benchmarkUtil.benchmark(
      'default-cd',
      () => AngularPerformanceUtils.measureComponentInit(defaultComponent),
      iterations
    );
    
    const onPushResult = await benchmarkUtil.benchmark(
      'onpush-cd',
      () => AngularPerformanceUtils.measureComponentInit(onPushComponent),
      iterations
    );

    return {
      defaultTime: defaultResult.averageTime,
      onPushTime: onPushResult.averageTime,
      improvement: ((defaultResult.averageTime - onPushResult.averageTime) / defaultResult.averageTime) * 100
    };
  }
}