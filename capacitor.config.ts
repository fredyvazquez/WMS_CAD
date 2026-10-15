import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.almacen.wms',
  appName: 'WMS Almacén',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
