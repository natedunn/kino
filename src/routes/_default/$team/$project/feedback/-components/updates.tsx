'use client';

import type { LucideIcon } from 'lucide-react';

import {
	Calendar,
	CirclePlus,
	CircleX,
	Copy,
	EyeOff,
	MoreHorizontal,
	PenLine,
	Reply,
	SmileIcon,
	SmilePlus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const items = [
	// {
	// 	type: 'status',
	// 	status: 'open',
	// 	content: `Feedback created`,
	// 	commentAttachments: null,
	// 	createdAt: new Date(),
	// 	user: {
	// 		name: 'John Doe',
	// 		username: 'johndoe',
	// 	},
	// },
	{
		type: 'comment',
		status: null,
		commentAttachments: [
			// placeholder image
			'https://pbs.twimg.com/media/GMUNeiIbwAA71f6?format=jpg&name=4096x4096',
			'https://pbs.twimg.com/media/GK80s7AaoAA0OzU?format=jpg&name=4096x4096',
		],
		content: `Eum dicta eos est sunt. Dolorem fugit amet exercitationem minus. Illo labore soluta cum cupiditate perspiciatis soluta eligendi. Maxime blanditiis corporis veritatis.<br/><br/> In soluta maxime magnam. Magnam eos dignissimos aut aut id officiis distinctio quod.
Repellat occaecati sapiente praesentium commodi necessitatibus possimus facere sed sed. Praesentium iusto quasi consequuntur totam corrupti cum. Eligendi voluptatibus facilis repellendus culpa.
Occaecati nam provident temporibus debitis asperiores eaque reprehenderit laborum dolorem. Aliquam in pariatur. Sit culpa fugiat beatae eius cum modi dolor. <br/><br/> Similique aut natus minima. Soluta a optio a fugiat cupiditate hic modi dolorum culpa. Dolorum aspernatur perspiciatis.
Hic tempora quia hic saepe sequi atque fuga quaerat exercitationem. Soluta ab distinctio beatae voluptates fuga perferendis quisquam amet aperiam.<br/><br/> Earum provident consequatur nemo eligendi voluptates voluptatibus quaerat nesciunt. Sapiente ipsam nam sapiente ab. A sit fugiat maxime architecto quasi harum adipisci quo. Vitae nemo sequi iusto impedit voluptatem neque rem.
In tempora maxime. Reiciendis velit ut accusamus repudiandae quas. Consequatur enim iure eaque aperiam officia deserunt dolore dolorem. Quae aperiam vero at.`,
		createdAt: new Date(),
		user: {
			name: 'John Doe',
			username: 'johndoe',
		},
	},
	{
		type: 'comment',
		status: null,
		commentAttachments: null,
		content:
			'Accusantium numquam consectetur id sunt exercitationem eius suscipit. Eligendi perspiciatis sed. Tempore cum dolorum repellat nisi harum quam quos odio quia. Velit minima consectetur animi odit laboriosam quis explicabo. Veritatis deleniti sint facilis enim eum quos vel at. Voluptate soluta nobis quos id.',
		createdAt: new Date(),
		user: {
			name: 'Nate Dunn',
			username: 'natedunn',
		},
	},
	{
		type: 'edit',
		status: null,
		commentAttachments: null,
		content: `Changed the title from 'Something' to 'Something else'`,
		createdAt: new Date(),
		user: {
			name: 'Nate Dunn',
			username: 'natedunn',
		},
	},
	{
		type: 'comment',
		status: null,
		commentAttachments: null,
		content:
			'Hic ipsa id architecto saepe vel. Aut eum fugit sapiente. Enim deserunt occaecati. Soluta laboriosam repudiandae quibusdam ad cumque deserunt excepturi. Quo et eveniet nesciunt. Pariatur deserunt eveniet dicta officia iure totam dicta.',
		createdAt: new Date(),
		user: {
			name: 'John Doe',
			username: 'johndoe',
		},
	},
	{
		type: 'status',
		status: 'closed',
		commentAttachments: null,
		content: `This feedback has been closed`,
		createdAt: new Date(),
		user: {
			name: 'Nate Dunn',
			username: 'natedunn',
		},
	},
	{
		type: 'comment',
		status: null,
		commentAttachments: null,
		content:
			'Quia quia voluptatem. Quis quis voluptas. Et et voluptas. Voluptatem voluptate voluptas.',
		createdAt: new Date(),
		user: {
			name: 'Nate Dunn',
			username: 'natedunn',
		},
	},
];

type Item = (typeof items)[number];

const Comment = ({ item }: { item: Item }) => {
	const params = {
		project: 'test',
		team: 'acme',
	};

	return (
		<li className='update-comment relative flex overflow-hidden rounded-lg border'>
			<div className='flex flex-col items-center justify-start border-r bg-muted pt-3 pl-4'>
				<div className='relative z-10 -mr-4 size-8 overflow-hidden rounded-full border bg-gradient-to-tr from-white/50 to-accent shadow-xl shadow-black'>
					<img
						className='size-8'
						src={`https://i.pravatar.cc/150?img=${item.user.username}`}
						alt=''
					/>
				</div>
			</div>
			<div className='flex w-full flex-col bg-background'>
				<div className='flex w-full justify-between gap-2 px-6 py-4'>
					<span>
						<a
							className='hocus:underline'
							href={`/console/p/${params.project}/u/${item.user.username}`}
						>
							@{item.user.username}
						</a>
						{` `}
						<span className='text-muted-foreground'>commented</span>
					</span>
					<div>12/12/2023</div>
				</div>
				<Separator className='w-full' />
				<div className='flex flex-col gap-4 p-4'>
					<div dangerouslySetInnerHTML={{ __html: item.content }} />
					{!!item.commentAttachments && (
						<div className='flex flex-col gap-2'>
							<span className='text-xs font-bold tracking-wide uppercase opacity-25 select-none'>
								Attachments
							</span>
							<div className='flex gap-2'>
								{item.commentAttachments?.map((attachment) => (
									<button
										// onClick={() => alert('Open attachment')}
										key={attachment}
										className='bg-native flex gap-2 overflow-hidden rounded-lg border transition-all duration-200 ease-in-out hocus:scale-105'
									>
										<img src={attachment} alt='' className='max-h-20 w-auto' />
									</button>
								))}
							</div>
						</div>
					)}
					<div className='flex items-center justify-between'>
						<div className='flex gap-2'>
							<Button className='gap-2 rounded-full' variant='ghost' size='sm'>
								<SmilePlus size={16} />
								<span className='sr-only'>Add reaction</span>
							</Button>
							<Button variant='outline' className='gap-2 rounded-full' size='sm'>
								<span>❤️</span>
								<span>2</span>
							</Button>
							<Button variant='outline' className='gap-2 rounded-full' size='sm'>
								<span>👍</span>
								<span>2</span>
							</Button>
						</div>
						<div className='flex justify-items-center gap-2'>
							<TooltipProvider delayDuration={100}>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant='ghost' size='sm' className='gap-2'>
											<Reply size={16} />
											<span className='sr-only'>Quote comment</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>Quote comment</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='ghost' size='sm'>
										<MoreHorizontal className='h-4 w-4' />
										<span className='sr-only'>More Actions</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='end'>
									<DropdownMenuItem>
										<Copy size={14} />
										Copy link
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem>
										<PenLine size={14} />
										Edit
									</DropdownMenuItem>
									<DropdownMenuItem>
										<EyeOff size={14} />
										Hide
									</DropdownMenuItem>
									<DropdownMenuItem>
										<CircleX size={14} />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				</div>
			</div>
		</li>
	);
};

// const Edit = ({ item }: { item: Item }) => {
// 	const params = useParams();
// 	return (
// 		<li className='flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent/50 to-transparent p-4 first-of-type:mt-0'>
// 			<div>
// 				<PenLine size={20} className='text-primary' />
// 			</div>
// 			{/* TODO: add icons for different types of items */}
// 			<div className='text-sm'>{item.content}</div>
// 			<div className='flex items-center gap-1 text-sm text-muted-foreground'>
// 				<span>by</span>
// 				<Link
// 					className='hocus:underline'
// 					href={`/console/p/${params.project}/u/${item.user.username}`}
// 				>
// 					@{item.user.username}
// 				</Link>
// 			</div>
// 		</li>
// 	);
// };

const Status = ({ item }: { item: Item }) => {
	// const params = useParams();

	const type = item.type as 'status' | 'comment' | 'edit';
	const status = item.status as 'open' | 'planned' | 'closed' | null;
	let Icon: LucideIcon = SmileIcon;

	if (type === 'status' && !status) {
		return null;
	}

	if (type === 'edit') {
		Icon = PenLine;
	}

	if (type === 'status' && !!status) {
		const statusIcon = {
			open: CirclePlus,
			planned: Calendar,
			closed: CircleX,
		} as const;
		Icon = statusIcon[status];
	}

	return (
		<li className='relative z-10 bg-background'>
			<div className='flex items-center gap-2 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/20 p-4 first-of-type:mt-0'>
				<div>
					<Icon size={20} className='text-primary' />
				</div>
				{/* TODO: add icons for different types of items */}
				<div className='text-sm'>{item.content}</div>
				<div className='flex items-center gap-1 text-sm text-muted-foreground'>
					<span>by</span>
					<a className='hocus:underline' href={`/console/p/nothing/u/${item.user.username}`}>
						@{item.user.username}
					</a>
				</div>
			</div>
		</li>
	);
};

export default function Updates() {
	if (!items || items.length <= 0) {
		return <div>No history found.</div>;
	}
	return (
		<div className='relative'>
			<div className='absolute left-[33px] h-full border-r opacity-50'></div>
			<ul className='flex flex-col gap-6'>
				{items.map((item, index) => {
					switch (item.type) {
						case 'comment':
							return <Comment key={index} item={item} />;
						case 'edit':
							return <Status key={index} item={item} />;
						case 'status':
							return <Status key={index} item={item} />;
						default:
							return null;
					}
				})}
			</ul>
		</div>
	);
}
