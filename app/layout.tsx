import type { Metadata } from 'next';

import { Geist, Geist_Mono } from 'next/font/google';

import './globals.css';

import { Link } from '@/components/link';
import { MainNav } from '@/components/main-nav';
import Providers from '@/kit/components/providers';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export const metadata: Metadata = {
	title: 'next-kit — by @natedunn',
	description: 'A starter kit made by @natedunn',
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang='en' suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<Providers>
					<div className='flex flex-col items-center px-6'>
						<div className='w-full max-w-[32rem] md:py-12'>
							<MainNav />
							<div className='mt-4'>{children}</div>
							<div className='border-t pt-6 mt-12'></div>
							<div className='flex items-center gap-4 justify-between mb-6 md:mb-0'>
								<div>
									Made by{' '}
									<Link className='link-as-text' href='https://bsky.app/profile/nate.social'>
										natedunn
									</Link>
								</div>
								<div className='flex gap-4 items-center'>
									<Link href='https://natedunn.net' className='link-as-text'>
										Website
									</Link>
									<Link href='https://github.com/natedunn/next-kit' className='link-as-text'>
										Github
									</Link>
								</div>
							</div>
						</div>
					</div>
				</Providers>
			</body>
		</html>
	);
}
