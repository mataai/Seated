import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import OpenSeatsDemo from './components/OpenSeatsDemo.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('OpenSeatsDemo', OpenSeatsDemo);
  },
} satisfies Theme;
