import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge } from 'rxjs';
import { map, debounceTime, startWith } from 'rxjs/operators';

export interface PerformanceSnapshot {
  timestamp: number;
  fps: number;
  memoryUsage: number;
  renderTime: number;
  changeDetectionTime: number;
  networkRequests: number;
  cacheHitRate: number;
}

export interface PerformanceAlert {
  type: 'warning' | 'error' | 'info';
  message: string;
  metric: string;
  threshold: number;
  current: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceMonitorService {
  private isMonitoring = false;
  private snapshots: PerformanceSnapshot[] = [];
  private alerts: PerformanceAlert[] = [];
  
  private performanceSubject = new BehaviorSubject<PerformanceSnapshot | null>(null);
  private alertsSubject = new BehaviorSubject<PerformanceAlert[]>([]);
  
  // Thresholds for performance alerts
  private readonly THRESHOLDS = {
    fps: { warning: 30, error: 15 },
    memoryUsage: { warning: 50 * 1024 * 1024, error: 100 * 1024 * 1024 }, // 50MB warning, 100MB error
    renderTime: { warning: 16, error: 33 }, // 60fps = 16ms, 30fps = 33ms
    changeDetectionTime: { warning: 10, error: 20 }
  };

  public performance$ = this.performanceSubject.asObservable();
  public alerts$ = this.alertsSubject.asObservable();

  /**
   * Inicia el monitoreo de performance
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('🚀 Performance Monitor iniciado');

    // Monitor FPS
    this.monitorFPS();
    
    // Monitor memory usage
    this.monitorMemoryUsage();
    
    // Monitor render performance
    this.monitorRenderPerformance();
    
    // Monitor network requests
    this.monitorNetworkRequests();

    // Take snapshots every 5 seconds
    setInterval(() => {
      if (this.isMonitoring) {
        this.takeSnapshot();
      }
    }, 5000);
  }

  /**
   * Detiene el monitoreo
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('⏹️ Performance Monitor detenido');
  }

  /**
   * Obtiene un reporte de performance
   */
  getPerformanceReport(): {
    summary: {
      averageFPS: number;
      averageMemory: number;
      averageRenderTime: number;
      peakMemory: number;
      totalAlerts: number;
    };
    snapshots: PerformanceSnapshot[];
    alerts: PerformanceAlert[];
  } {
    const snapshots = this.snapshots;
    
    if (snapshots.length === 0) {
      return {
        summary: {
          averageFPS: 0,
          averageMemory: 0,
          averageRenderTime: 0,
          peakMemory: 0,
          totalAlerts: this.alerts.length
        },
        snapshots: [],
        alerts: this.alerts
      };
    }

    const summary = {
      averageFPS: snapshots.reduce((sum, s) => sum + s.fps, 0) / snapshots.length,
      averageMemory: snapshots.reduce((sum, s) => sum + s.memoryUsage, 0) / snapshots.length,
      averageRenderTime: snapshots.reduce((sum, s) => sum + s.renderTime, 0) / snapshots.length,
      peakMemory: Math.max(...snapshots.map(s => s.memoryUsage)),
      totalAlerts: this.alerts.length
    };

    return {
      summary,
      snapshots: [...snapshots],
      alerts: [...this.alerts]
    };
  }

  /**
   * Genera reporte en consola
   */
  logPerformanceReport(): void {
    const report = this.getPerformanceReport();
    
    console.group('📊 REPORTE DE PERFORMANCE');
    console.log('🎯 Resumen:');
    console.log(`   FPS promedio: ${report.summary.averageFPS.toFixed(1)}`);
    console.log(`   Memoria promedio: ${(report.summary.averageMemory / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Tiempo render promedio: ${report.summary.averageRenderTime.toFixed(1)}ms`);
    console.log(`   Pico de memoria: ${(report.summary.peakMemory / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Total alertas: ${report.summary.totalAlerts}`);
    
    if (report.alerts.length > 0) {
      console.group('⚠️ Alertas:');
      report.alerts.forEach(alert => {
        const icon = alert.type === 'error' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵';
        console.log(`${icon} ${alert.message} (${alert.current} > ${alert.threshold})`);
      });
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  /**
   * Mide performance de una función específica
   */
  async measureFunction<T>(
    name: string,
    fn: () => T | Promise<T>
  ): Promise<{ result: T; duration: number; memoryDelta: number }> {
    const startTime = performance.now();
    const startMemory = this.getCurrentMemoryUsage();
    
    performance.mark(`${name}-start`);
    
    const result = await fn();
    
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const endTime = performance.now();
    const endMemory = this.getCurrentMemoryUsage();
    
    const duration = endTime - startTime;
    const memoryDelta = endMemory - startMemory;
    
    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms, memoria: ${memoryDelta > 0 ? '+' : ''}${(memoryDelta / 1024).toFixed(1)}KB`);
    
    return { result, duration, memoryDelta };
  }

  /**
   * Compara performance antes/después de una optimización
   */
  async compareImplementations<T>(
    name: string,
    oldImplementation: () => T | Promise<T>,
    newImplementation: () => T | Promise<T>,
    iterations: number = 10
  ): Promise<{
    oldStats: { avgTime: number; totalMemory: number };
    newStats: { avgTime: number; totalMemory: number };
    improvement: { timeImprovement: number; memoryImprovement: number };
  }> {
    console.group(`🔬 Comparando implementaciones: ${name}`);
    
    // Warm up
    await oldImplementation();
    await newImplementation();
    
    // Test old implementation
    console.log('📊 Testeando implementación original...');
    const oldTimes: number[] = [];
    const oldMemoryDeltas: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const measurement = await this.measureFunction(`${name}-old-${i}`, oldImplementation);
      oldTimes.push(measurement.duration);
      oldMemoryDeltas.push(measurement.memoryDelta);
    }
    
    // Test new implementation
    console.log('📊 Testeando implementación optimizada...');
    const newTimes: number[] = [];
    const newMemoryDeltas: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const measurement = await this.measureFunction(`${name}-new-${i}`, newImplementation);
      newTimes.push(measurement.duration);
      newMemoryDeltas.push(measurement.memoryDelta);
    }
    
    const oldStats = {
      avgTime: oldTimes.reduce((sum, t) => sum + t, 0) / iterations,
      totalMemory: oldMemoryDeltas.reduce((sum, m) => sum + m, 0)
    };
    
    const newStats = {
      avgTime: newTimes.reduce((sum, t) => sum + t, 0) / iterations,
      totalMemory: newMemoryDeltas.reduce((sum, m) => sum + m, 0)
    };
    
    const improvement = {
      timeImprovement: ((oldStats.avgTime - newStats.avgTime) / oldStats.avgTime) * 100,
      memoryImprovement: ((oldStats.totalMemory - newStats.totalMemory) / Math.abs(oldStats.totalMemory)) * 100
    };
    
    console.log('📈 Resultados:');
    console.log(`   Tiempo: ${oldStats.avgTime.toFixed(2)}ms → ${newStats.avgTime.toFixed(2)}ms (${improvement.timeImprovement > 0 ? '+' : ''}${improvement.timeImprovement.toFixed(1)}% mejora)`);
    console.log(`   Memoria: ${(oldStats.totalMemory / 1024).toFixed(1)}KB → ${(newStats.totalMemory / 1024).toFixed(1)}KB (${improvement.memoryImprovement > 0 ? '+' : ''}${improvement.memoryImprovement.toFixed(1)}% mejora)`);
    
    console.groupEnd();
    
    return { oldStats, newStats, improvement };
  }

  // Private methods
  private takeSnapshot(): void {
    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      fps: this.getCurrentFPS(),
      memoryUsage: this.getCurrentMemoryUsage(),
      renderTime: this.getCurrentRenderTime(),
      changeDetectionTime: this.getChangeDetectionTime(),
      networkRequests: this.getNetworkRequestCount(),
      cacheHitRate: this.getCacheHitRate()
    };
    
    this.snapshots.push(snapshot);
    this.performanceSubject.next(snapshot);
    
    // Check for alerts
    this.checkAlerts(snapshot);
    
    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }
  }

  private checkAlerts(snapshot: PerformanceSnapshot): void {
    // Check FPS
    if (snapshot.fps < this.THRESHOLDS.fps.error) {
      this.addAlert('error', 'FPS crítico detectado', 'fps', this.THRESHOLDS.fps.error, snapshot.fps);
    } else if (snapshot.fps < this.THRESHOLDS.fps.warning) {
      this.addAlert('warning', 'FPS bajo detectado', 'fps', this.THRESHOLDS.fps.warning, snapshot.fps);
    }
    
    // Check memory
    if (snapshot.memoryUsage > this.THRESHOLDS.memoryUsage.error) {
      this.addAlert('error', 'Uso de memoria crítico', 'memory', this.THRESHOLDS.memoryUsage.error, snapshot.memoryUsage);
    } else if (snapshot.memoryUsage > this.THRESHOLDS.memoryUsage.warning) {
      this.addAlert('warning', 'Alto uso de memoria detectado', 'memory', this.THRESHOLDS.memoryUsage.warning, snapshot.memoryUsage);
    }
    
    // Check render time
    if (snapshot.renderTime > this.THRESHOLDS.renderTime.error) {
      this.addAlert('error', 'Tiempo de render crítico', 'renderTime', this.THRESHOLDS.renderTime.error, snapshot.renderTime);
    } else if (snapshot.renderTime > this.THRESHOLDS.renderTime.warning) {
      this.addAlert('warning', 'Tiempo de render alto', 'renderTime', this.THRESHOLDS.renderTime.warning, snapshot.renderTime);
    }
  }

  private addAlert(type: 'warning' | 'error' | 'info', message: string, metric: string, threshold: number, current: number): void {
    const alert: PerformanceAlert = {
      type,
      message,
      metric,
      threshold,
      current,
      timestamp: Date.now()
    };
    
    this.alerts.push(alert);
    this.alertsSubject.next([...this.alerts]);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }
  }

  private monitorFPS(): void {
    let frames = 0;
    let lastTime = performance.now();
    
    const countFrame = () => {
      frames++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime));
        (this as any).currentFPS = fps;
        frames = 0;
        lastTime = currentTime;
      }
      
      if (this.isMonitoring) {
        requestAnimationFrame(countFrame);
      }
    };
    
    requestAnimationFrame(countFrame);
  }

  private monitorMemoryUsage(): void {
    // Memory monitoring is handled in takeSnapshot
  }

  private monitorRenderPerformance(): void {
    // Render performance monitoring is handled in takeSnapshot
  }

  private monitorNetworkRequests(): void {
    // Network monitoring could be enhanced with interceptors
  }

  private getCurrentFPS(): number {
    return (this as any).currentFPS || 60;
  }

  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  private getCurrentRenderTime(): number {
    // This would need to be measured during actual renders
    const entries = performance.getEntriesByType('measure');
    const renderEntries = entries.filter(entry => entry.name.includes('render'));
    
    if (renderEntries.length > 0) {
      return renderEntries[renderEntries.length - 1].duration;
    }
    
    return 0;
  }

  private getChangeDetectionTime(): number {
    const entries = performance.getEntriesByType('measure');
    const cdEntries = entries.filter(entry => entry.name.includes('change-detection'));
    
    if (cdEntries.length > 0) {
      return cdEntries[cdEntries.length - 1].duration;
    }
    
    return 0;
  }

  private getNetworkRequestCount(): number {
    // This would need to be tracked via HTTP interceptors
    return 0;
  }

  private getCacheHitRate(): number {
    // This would need to be calculated based on service metrics
    return 85; // Mock value for now
  }
}