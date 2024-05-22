import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: { // 该字段用于配制开发服务器的代理功能，下面包含两个代理规则
      '/local': {
        target: 'http://localhost:8080', // 所有发往 /local 的请求都会被代理（转发）到 http://localhost:8080
        changeOrigin: true, // 指示代理服务器在转发请求时更改请求的 origin 头部，这通常用于绕过跨域限制
        
        rewrite: (path) => path.replace(/^\/local/, '/'),
        // 函数用于重写请求路径，将 /local 前缀替换为空字符串，这样当请求被代理到目标服务器时，它看起来就像是一个直接针对该服务器的请求
      },
      '/ahocevar': {
        target: 'https://ahocevar.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ahocevar/, '/'),
      }
    }
  }

})
