type TitleBarProps = {
	children: React.ReactNode;
};

export const TitleBar = ({ children }: TitleBarProps) => {
	return <div className='m-4 px-4'>{children}</div>;
};
