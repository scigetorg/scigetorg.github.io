// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

const SITE = 'https://sciget.org';

export default defineConfig({
	site: SITE,
	redirects: {
		'/acknowledgement': '/acknowledgements/',
		'/acknowledgment': '/acknowledgements/',
		'/donate': '/sponsor/',
		'/overview/metrics': '/metrics/',
	},
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
				// Starlight sets twitter:card=summary_large_image but emits no og:image.
				{ tag: 'meta', attrs: { property: 'og:image', content: `${SITE}/og-default.png` } },
				{ tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
				{ tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
				{
					tag: 'meta',
					attrs: {
						property: 'og:image:alt',
						content: 'SCIGET — Run scientific software anywhere',
					},
				},
				{ tag: 'meta', attrs: { name: 'twitter:image', content: `${SITE}/og-default.png` } },
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:image:alt',
						content: 'SCIGET — Run scientific software anywhere',
					},
				},
				{
					tag: 'meta',
					attrs: { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' },
				},
				{
					tag: 'meta',
					attrs: { name: 'theme-color', content: '#17181c', media: '(prefers-color-scheme: dark)' },
				},
				{ tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicons/apple-touch-icon.png' } },
				{ tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicons/favicon-32x32.png' } },
				{ tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicons/favicon-16x16.png' } },
				{ tag: 'link', attrs: { rel: 'manifest', href: '/favicons/site.webmanifest' } },
				{
					tag: 'script',
					content: `
						if (['sciget.org', 'www.sciget.org'].includes(window.location.hostname)) {
							window.dataLayer = window.dataLayer || [];
							window.gtag = function(){window.dataLayer.push(arguments);};

							const googleTag = document.createElement('script');
							googleTag.async = true;
							googleTag.src = 'https://www.googletagmanager.com/gtag/js?id=G-4Z9774J59Y';
							document.head.appendChild(googleTag);

							window.gtag('js', new Date());
							window.gtag('config', 'G-4Z9774J59Y');
						}
					`,
				},
			],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/scigetorg' },
				{ icon: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/company/sciget-org/' },
			],
			components: {
				// Cycling theme toggle (auto → light → dark) instead of the dropdown.
				ThemeSelect: './src/components/ThemeSelect.astro',
			},
			editLink: {
				baseUrl: 'https://github.com/scigetorg/scigetorg.github.io/edit/main/',
			},
			sidebar: [
				{
					label: 'Get Started',
					items: [{ autogenerate: { directory: 'get-started' } }],
				},
				{
					label: 'Applications',
					link: '/applications/',
				},
				{
					label: 'Webapps',
					link: 'https://webapps.sciget.org/',
					attrs: { target: '_blank', rel: 'noopener noreferrer' },
				},
				{
					label: 'Contribute',
					link: '/contribute/',
				},
				{
					label: 'About',
					items: [
						{ label: 'About SCIGET', link: '/about/' },
						{ label: 'Metrics', link: '/metrics/' },
						{ label: 'Acknowledgements', link: '/acknowledgements/' },
					],
				},
				{
					label: 'Sponsor',
					link: '/sponsor/',
				},
			],
			customCss: ['./src/styles/base.css', './src/styles/custom.css'],
			routeMiddleware: './src/starlightRouteData.ts',
		}),
		react(),
		mdx(),
	],
});
