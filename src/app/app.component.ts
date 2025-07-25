import { Component, OnInit, OnDestroy } from '@angular/core';
import { PerformanceMonitorService } from './shared/utils/performance-monitor.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'client-list';
  
  constructor(private performanceMonitor: PerformanceMonitorService) {}

  ngOnInit(): void {
    // Solo en desarrollo, iniciar monitoreo de performance
    if (!environment.production) {
      this.performanceMonitor.startMonitoring();
      
      // Mostrar reporte cada 30 segundos en desarrollo
      setInterval(() => {
        this.performanceMonitor.logPerformanceReport();
      }, 30000);
    }
  }

  ngOnDestroy(): void {
    this.performanceMonitor.stopMonitoring();
  }
}
