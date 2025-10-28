// src/utils/reportWebVitals.ts
// Optional performance reporting utility.
// Call: import reportWebVitals from '@/utils/reportWebVitals'; reportWebVitals(console.log);

export type Metric = {
  name: string;
  value: number;
  id?: string;
  label?: string;
  delta?: number;
};

export default function reportWebVitals(onPerfEntry?: (metric: Metric) => void): void {
  if (onPerfEntry && typeof onPerfEntry === 'function' && typeof window !== 'undefined') {
    // dynamic import so project still runs if web-vitals isn't installed
    import('web-vitals')
      .then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS(onPerfEntry);
        getFID(onPerfEntry);
        getFCP(onPerfEntry);
        getLCP(onPerfEntry);
        getTTFB(onPerfEntry);
      })
      .catch(() => {
        // web-vitals package not present — ignore gracefully
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.info('reportWebVitals: web-vitals not installed.');
        }
      });
  }
}
