export const SKILLS = [
	'font-end',
	'backend',
	'design',
	'devops',
	'data-science',
	'full-stack',
] as const;

export const STAGE = [
	'Planning',
	'Validation',
	'Proof of concept',
	'Building',
	'Alpha',
	'Beta',
	'Pre launch',
	'Soft launch',
	'Public launch',
	'Early growth',
	'Product market fit',
	'Scaling',
	'Mature',
	'Exited',
	'Paused',
	'Closed',
] as const;

export const BUSINESS_MODEL = [
	{
		id: 'b2b',
		text: 'B2B',
	},
	{
		id: 'b2c',
		text: 'B2C',
	},
	{
		id: 'community',
		text: 'Community',
	},
	{
		id: 'ecommerce',
		text: 'eCommerce',
	},
	{
		id: 'saas',
		text: 'SaaS',
	},
	{
		id: 'freemium',
		text: 'Freemium',
	},
	{
		id: 'creative',
		text: 'Creative',
	},
	{
		id: 'marketplace',
		text: 'Marketplace',
	},
	{
		id: 'subscription',
		text: 'Subscription',
	},
];

export const STACK_TECH = [
	{
		text: 'React',
		categories: ['Frontend', 'UI', 'Library'],
		id: 'react',
	},
	{
		text: 'Vue.js',
		categories: ['Frontend', 'UI', 'Framework'],
		id: 'vue-js',
	},
	{
		text: 'Angular',
		categories: ['Frontend', 'UI', 'Framework'],
		id: 'angular',
	},
	{
		text: 'Next.js',
		categories: ['Frontend', 'UI', 'Framework', 'SSR'],
		id: 'next-js',
	},
	{
		text: 'Tanstack Start',
		categories: ['Frontend', 'UI', 'Library', 'SSR', 'streaming', 'server'],
		id: 'tanstack-start',
	},
	{
		text: 'Tanstack Query',
		categories: ['state management', 'data', 'streaming', 'async'],
		id: 'tanstack-query',
	},
	{
		text: 'Tanstack Form',
		categories: ['headless', 'form', 'state management'],
		id: 'tanstack-form',
	},
	{
		text: 'Nuxt',
		categories: ['Frontend', 'UI', 'Framework', 'SSR'],
		id: 'nuxt',
	},
	{
		text: 'Svelte',
		categories: ['Frontend', 'UI', 'Framework'],
		id: 'svelte',
	},
	{
		text: 'Astro',
		categories: ['Frontend', 'UI', 'Framework', 'Static Site'],
		id: 'astro',
	},
	{
		text: 'Qwik',
		categories: ['Frontend', 'UI', 'Framework', 'Resumable'],
		id: 'qwik',
	},
	{
		text: 'Node.js',
		categories: ['Backend', 'Runtime', 'JavaScript'],
		id: 'node-js',
	},
	{
		text: 'Express',
		categories: ['Backend', 'Framework', 'Node.js'],
		id: 'express',
	},
	{
		text: 'Fastify',
		categories: ['Backend', 'Framework', 'Node.js'],
		id: 'fastify',
	},
	{
		text: 'Django',
		categories: ['Backend', 'Framework', 'Python'],
		id: 'django',
	},
	{
		text: 'Rails',
		categories: ['Backend', 'Framework', 'Ruby'],
		id: 'rails',
	},
	{
		text: 'Laravel',
		categories: ['Backend', 'Framework', 'PHP'],
		id: 'laravel',
	},
	{
		text: 'Spring Boot',
		categories: ['Backend', 'Framework', 'Java'],
		id: 'spring-boot',
	},
	{
		text: 'ASP.NET Core',
		categories: ['Backend', 'Framework', '.NET'],
		id: 'asp-net-core',
	},
	{
		text: 'Flask',
		categories: ['Backend', 'Framework', 'Python'],
		id: 'flask',
	},
	{
		text: 'GraphQL',
		categories: ['API', 'Query Language'],
		id: 'graphql',
	},
	{
		text: 'REST',
		categories: ['API', 'Architecture'],
		id: 'rest',
	},
	{
		text: 'MongoDB',
		categories: ['Database', 'NoSQL', 'Document'],
		id: 'mongodb',
	},
	{
		text: 'PostgreSQL',
		categories: ['Database', 'SQL', 'Relational'],
		id: 'postgresql',
	},
	{
		text: 'MySQL',
		categories: ['Database', 'SQL', 'Relational'],
		id: 'mysql',
	},
	{
		text: 'Redis',
		categories: ['Database', 'NoSQL', 'In-Memory', 'Cache'],
		id: 'redis',
	},
	{
		text: 'Supabase',
		categories: ['Database', 'BaaS', 'Auth', 'Storage'],
		id: 'supabase',
	},
	{
		text: 'Firebase',
		categories: ['Database', 'BaaS', 'Auth', 'Hosting'],
		id: 'firebase',
	},
	{
		text: 'Drizzle',
		categories: ['Database', 'ORM', 'SQL'],
		id: 'drizzle',
	},
	{
		text: 'Prisma',
		categories: ['Database', 'ORM', 'SQL'],
		id: 'prisma',
	},
	{
		text: 'TypeORM',
		categories: ['Database', 'ORM', 'SQL'],
		id: 'typeorm',
	},
	{
		text: 'Sequelize',
		categories: ['Database', 'ORM', 'SQL'],
		id: 'sequelize',
	},
	{
		text: 'Tailwind CSS',
		categories: ['CSS', 'Utility', 'Framework'],
		id: 'tailwind-css',
	},
	{
		text: 'Bootstrap',
		categories: ['CSS', 'UI', 'Framework'],
		id: 'bootstrap',
	},
	{
		text: 'Material UI',
		categories: ['UI', 'Component Library', 'React'],
		id: 'material-ui',
	},
	{
		text: 'Chakra UI',
		categories: ['UI', 'Component Library', 'React'],
		id: 'chakra-ui',
	},
	{
		text: 'Ant Design',
		categories: ['UI', 'Component Library', 'React'],
		id: 'ant-design',
	},
	{
		text: 'Styled Components',
		categories: ['CSS', 'CSS-in-JS'],
		id: 'styled-components',
	},
	{
		text: 'Emotion',
		categories: ['CSS', 'CSS-in-JS'],
		id: 'emotion',
	},
	{
		text: 'Sass/SCSS',
		categories: ['CSS', 'Preprocessor'],
		id: 'sass-scss',
	},
	{
		text: 'Less',
		categories: ['CSS', 'Preprocessor'],
		id: 'less',
	},
	{
		text: 'TypeScript',
		categories: ['Language', 'JavaScript', 'Static Typing'],
		id: 'typescript',
	},
	{
		text: 'JavaScript',
		categories: ['Language', 'Frontend', 'Backend'],
		id: 'javascript',
	},
	{
		text: 'Webpack',
		categories: ['Build Tool', 'Bundler'],
		id: 'webpack',
	},
	{
		text: 'Vite',
		categories: ['Build Tool', 'Bundler', 'Dev Server'],
		id: 'vite',
	},
	{
		text: 'esbuild',
		categories: ['Build Tool', 'Bundler'],
		id: 'esbuild',
	},
	{
		text: 'Rollup',
		categories: ['Build Tool', 'Bundler'],
		id: 'rollup',
	},
	{
		text: 'Docker',
		categories: ['DevOps', 'Containerization'],
		id: 'docker',
	},
	{
		text: 'Kubernetes',
		categories: ['DevOps', 'Orchestration'],
		id: 'kubernetes',
	},
	{
		text: 'AWS',
		categories: ['Cloud', 'Hosting', 'Services'],
		id: 'aws',
	},
	{
		text: 'Azure',
		categories: ['Cloud', 'Hosting', 'Services'],
		id: 'azure',
	},
	{
		text: 'GCP',
		categories: ['Cloud', 'Hosting', 'Services'],
		id: 'gcp',
	},
	{
		text: 'Vercel',
		categories: ['Hosting', 'Frontend', 'Serverless'],
		id: 'vercel',
	},
	{
		text: 'Netlify',
		categories: ['Hosting', 'Frontend', 'Serverless'],
		id: 'netlify',
	},
	{
		text: 'Cloudflare',
		categories: ['CDN', 'Hosting', 'DNS', 'SSL'],
		id: 'cloudflare',
	},
	{
		text: 'Heroku',
		categories: ['Hosting', 'PaaS'],
		id: 'heroku',
	},
	{
		text: 'Digital Ocean',
		categories: ['Hosting', 'IaaS', 'Cloud'],
		id: 'digital-ocean',
	},
	{
		text: 'Redux',
		categories: ['State Management', 'Frontend', 'React'],
		id: 'redux',
	},
	{
		text: 'Zustand',
		categories: ['State Management', 'Frontend', 'React'],
		id: 'zustand',
	},
	{
		text: 'MobX',
		categories: ['State Management', 'Frontend'],
		id: 'mobx',
	},
	{
		text: 'Pinia',
		categories: ['State Management', 'Frontend', 'Vue'],
		id: 'pinia',
	},
	{
		text: 'JWT',
		categories: ['Authentication', 'Security'],
		id: 'jwt',
	},
	{
		text: 'OAuth',
		categories: ['Authentication', 'Security'],
		id: 'oauth',
	},
	{
		text: 'SAML',
		categories: ['Authentication', 'Enterprise'],
		id: 'saml',
	},
	{
		text: 'Jest',
		categories: ['Testing', 'Unit', 'Integration'],
		id: 'jest',
	},
	{
		text: 'Vitest',
		categories: ['Testing', 'Unit', 'Integration'],
		id: 'vitest',
	},
	{
		text: 'Cypress',
		categories: ['Testing', 'E2E'],
		id: 'cypress',
	},
	{
		text: 'Playwright',
		categories: ['Testing', 'E2E'],
		id: 'playwright',
	},
	{
		text: 'Storybook',
		categories: ['UI', 'Documentation', 'Testing'],
		id: 'storybook',
	},
	{
		text: 'WebSockets',
		categories: ['Protocol', 'Real-time'],
		id: 'websockets',
	},
	{
		text: 'WebRTC',
		categories: ['Protocol', 'Real-time', 'Media'],
		id: 'webrtc',
	},
	{
		text: 'PWA',
		categories: ['Mobile', 'Web', 'Architecture'],
		id: 'pwa',
	},
	{
		text: 'Flutter',
		categories: ['Mobile', 'Cross-platform', 'Framework'],
		id: 'flutter',
	},
	{
		text: 'React Native',
		categories: ['Mobile', 'Cross-platform', 'Framework'],
		id: 'react-native',
	},
	{
		text: 'Electron',
		categories: ['Desktop', 'Cross-platform', 'Framework'],
		id: 'electron',
	},
	{
		text: 'Tauri',
		categories: ['Desktop', 'Cross-platform', 'Framework'],
		id: 'tauri',
	},
] as const;

export const TOOLS = [
	{
		text: 'Figma',
		categories: ['Design', 'UI', 'UX', 'Prototyping', 'Collaboration'],
		id: 'figma',
	},
	{
		text: 'Sketch',
		categories: ['Design', 'UI', 'UX', 'Prototyping'],
		id: 'sketch',
	},
	{
		text: 'Adobe XD',
		categories: ['Design', 'UI', 'UX', 'Prototyping'],
		id: 'adobe-xd',
	},
	{
		text: 'Adobe Photoshop',
		categories: ['Design', 'Graphics', 'Image Editing'],
		id: 'adobe-photoshop',
	},
	{
		text: 'Adobe Illustrator',
		categories: ['Design', 'Vector Graphics'],
		id: 'adobe-illustrator',
	},
	{
		text: 'Framer',
		categories: ['Design', 'Prototyping', 'Animation', 'Code'],
		id: 'framer',
	},
	{
		text: 'InVision',
		categories: ['Design', 'Prototyping', 'Collaboration'],
		id: 'invision',
	},
	{
		text: 'Axure RP',
		categories: ['Design', 'Prototyping', 'UX'],
		id: 'axure-rp',
	},
	{
		text: 'Zeplin',
		categories: ['Design', 'Developer Handoff'],
		id: 'zeplin',
	},
	{
		text: 'Webflow',
		categories: ['Design', 'No-Code', 'CMS', 'Hosting'],
		id: 'webflow',
	},
	{
		text: 'Bubble',
		categories: ['No-Code', 'App Builder', 'Database'],
		id: 'bubble',
	},
	{
		text: 'Airtable',
		categories: ['Database', 'Spreadsheet', 'Collaboration'],
		id: 'airtable',
	},
	{
		text: 'Notion',
		categories: ['CMS', 'Documentation', 'Collaboration', 'Project Management'],
		id: 'notion',
	},
	{
		text: 'Confluence',
		categories: ['Documentation', 'Collaboration', 'Wiki'],
		id: 'confluence',
	},
	{
		text: 'VS Code',
		categories: ['IDE', 'Code Editor'],
		id: 'vs-code',
	},
	{
		text: 'WebStorm',
		categories: ['IDE', 'JavaScript'],
		id: 'webstorm',
	},
	{
		text: 'Sublime Text',
		categories: ['Code Editor'],
		id: 'sublime-text',
	},
	{
		text: 'Vim',
		categories: ['Code Editor', 'Terminal'],
		id: 'vim',
	},
	{
		text: 'Git',
		categories: ['Version Control'],
		id: 'git',
	},
	{
		text: 'GitHub',
		categories: ['Version Control', 'Collaboration', 'CI/CD'],
		id: 'github',
	},
	{
		text: 'GitLab',
		categories: ['Version Control', 'Collaboration', 'CI/CD'],
		id: 'gitlab',
	},
	{
		text: 'Bitbucket',
		categories: ['Version Control', 'Collaboration', 'CI/CD'],
		id: 'bitbucket',
	},
	{
		text: 'Jira',
		categories: ['Project Management', 'Issue Tracking'],
		id: 'jira',
	},
	{
		text: 'Trello',
		categories: ['Project Management', 'Kanban'],
		id: 'trello',
	},
	{
		text: 'Asana',
		categories: ['Project Management', 'Task Tracking'],
		id: 'asana',
	},
	{
		text: 'ClickUp',
		categories: ['Project Management', 'Task Tracking', 'Documentation'],
		id: 'clickup',
	},
	{
		text: 'Linear',
		categories: ['Project Management', 'Issue Tracking'],
		id: 'linear',
	},
	{
		text: 'Postman',
		categories: ['API', 'Testing', 'Documentation'],
		id: 'postman',
	},
	{
		text: 'Insomnia',
		categories: ['API', 'Testing'],
		id: 'insomnia',
	},
	{
		text: 'Chrome DevTools',
		categories: ['Debugging', 'Performance', 'Testing'],
		id: 'chrome-devtools',
	},
	{
		text: 'Lighthouse',
		categories: ['Performance', 'Testing', 'SEO', 'Accessibility'],
		id: 'lighthouse',
	},
	{
		text: 'Google Analytics',
		categories: ['Analytics', 'Tracking'],
		id: 'google-analytics',
	},
	{
		text: 'Hotjar',
		categories: ['Analytics', 'Heatmaps', 'User Testing'],
		id: 'hotjar',
	},
	{
		text: 'Mixpanel',
		categories: ['Analytics', 'User Behavior'],
		id: 'mixpanel',
	},
	{
		text: 'Optimizely',
		categories: ['A/B Testing', 'Experimentation'],
		id: 'optimizely',
	},
	{
		text: 'Slack',
		categories: ['Communication', 'Collaboration'],
		id: 'slack',
	},
	{
		text: 'Discord',
		categories: ['Communication', 'Collaboration'],
		id: 'discord',
	},
	{
		text: 'Teams',
		categories: ['Communication', 'Collaboration'],
		id: 'teams',
	},
	{
		text: 'Figma Dev Mode',
		categories: ['Design', 'Development', 'Handoff'],
		id: 'figma-dev-mode',
	},
	{
		text: 'Loom',
		categories: ['Communication', 'Video', 'Documentation'],
		id: 'loom',
	},
	{
		text: 'npm',
		categories: ['Package Manager', 'JavaScript'],
		id: 'npm',
	},
	{
		text: 'yarn',
		categories: ['Package Manager', 'JavaScript'],
		id: 'yarn',
	},
	{
		text: 'pnpm',
		categories: ['Package Manager', 'JavaScript'],
		id: 'pnpm',
	},
	{
		text: 'ESLint',
		categories: ['Linting', 'Code Quality'],
		id: 'eslint',
	},
	{
		text: 'Prettier',
		categories: ['Formatting', 'Code Quality'],
		id: 'prettier',
	},
	{
		text: 'GitHub Copilot',
		categories: ['AI', 'Code Assistance'],
		id: 'github-copilot',
	},
	{
		text: 'Sentry',
		categories: ['Error Tracking', 'Monitoring'],
		id: 'sentry',
	},
	{
		text: 'DataDog',
		categories: ['Monitoring', 'Observability'],
		id: 'datadog',
	},
	{
		text: 'New Relic',
		categories: ['Monitoring', 'Performance'],
		id: 'new-relic',
	},
	{
		text: 'LogRocket',
		categories: ['Monitoring', 'Session Replay', 'Analytics'],
		id: 'logrocket',
	},
	{
		text: 'Miro',
		categories: ['Collaboration', 'Whiteboard', 'Planning'],
		id: 'miro',
	},
	{
		text: 'Canva',
		categories: ['Design', 'Graphics', 'Templates'],
		id: 'canva',
	},
] as const;
