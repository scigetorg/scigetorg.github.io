/**
 * Data model for the Get Started setup chooser, ported from neurodesk.org.
 * Axes, support rules and outcomes are declared separately, so a combination
 * is matched, not enumerated.
 */

export type AxisId = 'platform' | 'interface' | 'access' | 'os';

export interface AxisOption {
	id: string;
	label: string;
}

export interface Axis {
	id: AxisId;
	label: string;
	options: AxisOption[];
}

export const axes: Axis[] = [
	{
		id: 'platform',
		label: 'Where to run',
		options: [
			{ id: 'local', label: 'My computer' },
			{ id: 'hosted', label: 'Hosted (no install)' },
			{ id: 'hpc', label: 'HPC' },
		],
	},
	{
		id: 'interface',
		label: 'Interface',
		options: [
			{ id: 'desktop', label: 'Desktop' },
			{ id: 'webapp', label: 'Web app' },
			{ id: 'cmd', label: 'Command line' },
		],
	},
	{
		id: 'access',
		label: 'Admin rights',
		options: [
			{ id: 'admin', label: 'Yes' },
			{ id: 'user', label: 'No' },
		],
	},
	{
		id: 'os',
		label: 'Your OS',
		options: [
			{ id: 'linux', label: 'Linux' },
			{ id: 'macos', label: 'Mac' },
			{ id: 'windows', label: 'Windows' },
		],
	},
];

/** What an option is compatible with. An axis left out is unconstrained. */
export type Constraint = Partial<Record<AxisId, string[]>>;

export const constraints: Record<string, Constraint> = {
	// No graphical desktop on HPC yet; webapps run on your own machine.
	desktop: { platform: ['local', 'hosted'] },
	webapp: { platform: ['local'] },
};

export const defaults: Record<AxisId, string> = {
	platform: 'local',
	interface: 'desktop',
	access: 'admin',
	os: 'linux',
};

export interface OutcomeCard {
	title: string;
	description: string;
	href: string;
}

export interface Outcome {
	id: string;
	/** Every listed axis must contain the current selection for this to show. */
	when: Constraint;
	cards: OutcomeCard[];
}

/** Additive: every matching entry renders, so later entries layer extra cards. */
export const outcomes: Outcome[] = [
	{
		id: 'webapps',
		when: { interface: ['webapp'], platform: ['local'] },
		cards: [
			{
				title: 'Sciget Webapps',
				description:
					'Run individual scientific tools locally in your browser, with nothing to install and no data uploaded. Browser and GPU requirements vary by app.',
				href: 'https://webapps.sciget.org/',
			},
		],
	},
	{
		id: 'app-docker',
		when: { interface: ['desktop'], platform: ['local'], access: ['admin'] },
		cards: [
			{
				title: 'Sciget App with Docker or Podman',
				description:
					'Cross-platform desktop app that manages the container for you. The recommended starting point.',
				href: '/get-started/scigetapp/#installing-docker',
			},
		],
	},
	{
		id: 'app-tinyrange',
		when: { interface: ['desktop'], platform: ['local'], access: ['user'] },
		cards: [
			{
				title: 'Sciget App with TinyRange',
				description:
					'No root needed. The app runs Sciget in a lightweight VM using the bundled TinyRange engine.',
				href: '/get-started/scigetapp/#determine-system-privileges',
			},
		],
	},
	{
		id: 'app-tinyrange-macos',
		when: { interface: ['desktop'], platform: ['local'], access: ['user'], os: ['macos'] },
		cards: [
			{
				title: 'Install QEMU first',
				description: 'TinyRange on macOS needs QEMU, which you can install with Homebrew.',
				href: '/get-started/scigetapp/#installing-qemu',
			},
		],
	},
	{
		id: 'play',
		when: { platform: ['hosted'] },
		cards: [
			{
				title: 'Sciget Play',
				description: 'Free hosted Sciget in your browser, with a desktop, JupyterLab and a terminal. Nothing to install.',
				href: '/get-started/play/',
			},
		],
	},
	{
		id: 'app-remote',
		when: { interface: ['desktop'], platform: ['hosted'] },
		cards: [
			{
				title: 'Connect the Sciget App to a server',
				description: 'Use the desktop app as a window onto a remote Sciget server.',
				href: '/get-started/scigetapp/#connecting-to-a-remote-server',
			},
		],
	},
	{
		id: 'cli',
		when: { interface: ['cmd'], platform: ['local', 'hpc'] },
		cards: [
			{
				title: 'sciget command-line tool (preview)',
				description:
					'One static binary that finds, downloads and runs containerised tools through Apptainer, without root. Not yet released.',
				href: 'https://github.com/scigetorg/sciget',
			},
		],
	},
	{
		id: 'hpc-neurodesk',
		when: { platform: ['hpc'] },
		cards: [
			{
				title: 'Neurodesk on HPC',
				description: 'For neuroimaging today, install Neurodesk on your cluster and load tools as Lmod modules.',
				href: 'https://neurodesk.org/getting-started/neurocommand/linux-and-hpc/',
			},
		],
	},
];
