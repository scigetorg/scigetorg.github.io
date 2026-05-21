// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

export default defineConfig({
	site: 'https://sciget.org',
	integrations: [
		starlight({
			title: 'SCIGET',
			description: 'Enabling Scientific Analysis. Your platform for flexible, scalable, accessible research.',
			logo: {
				src: './src/assets/sciget-wordmark.svg',
				replacesTitle: true,
			},
			favicon: '/favicons/favicon.ico',
			head: [
				{ tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicons/apple-touch-icon.png' } },
				{ tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicons/favicon-32x32.png' } },
				{ tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicons/favicon-16x16.png' } },
				{ tag: 'link', attrs: { rel: 'manifest', href: '/favicons/site.webmanifest' } },
			],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/scigetorg' },
			],
			editLink: {
				baseUrl: 'https://github.com/scigetorg/scigetorg.github.io/edit/main/',
			},
			sidebar: [
				{
					label: 'Get Started',
					items: [{ autogenerate: { directory: 'get-started' } }],
				},
				{
					label: 'Contribute',
					link: '/contribute/',
				},
				{
					label: 'About',
					link: '/about/',
				},
			],
			customCss: ['./src/styles/custom.css'],
		}),
		react(),
		mdx(),
	],
});
