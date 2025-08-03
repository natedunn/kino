export const AssignedTo = () => {
	return (
		<div className='flex border bg-muted/50'>
			<div className='flex items-center justify-center border-r bg-muted px-4'>
				<div className='mr-[-2.25rem] size-10 overflow-hidden rounded-full border'>
					<img src='https://i.pravatar.cc/150?img=natedunn' alt='natedunn' />
				</div>
			</div>
			<div className='flex w-full flex-col justify-center px-8 py-3'>
				<div className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
					Assigned to
				</div>
				<div>Nate Dunn (@natedunn)</div>
			</div>
		</div>
	);
};
