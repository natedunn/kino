type TitleBarProps = {
	children: React.ReactNode;
};

export const TitleBar = ({ children }: TitleBarProps) => {
	// return (
	// 	<div className='m-4 flex h-14 w-full items-center rounded-xl border border-border bg-gradient-to-b from-muted/70 to-muted/50 px-6 shadow-[0px_10px_16px_-3px_rgba(0,_0,_0,_0.05)] backdrop-blur-md'>
	// 		{children}
	// 	</div>
	// );
	return <div className='m-4 px-4'>{children}</div>;
};
