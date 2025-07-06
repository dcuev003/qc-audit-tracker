export const Footer = () => {
	return (
		<footer className='bg-white border-t border-gray-200'>
			<div className='py-3'>
				<div className='text-center flex justify-center items-center text-sm text-gray-500 gap-0.5'>
					Crafted with
					<span className='text-indigo-600'>⚡</span>
					by
					<a
						href='https://github.com/zeroxvee'
						target='_blank'
						rel='noopener noreferrer'
						className='text-indigo-600 hover:text-indigo-700 font-medium transition-colors'>
						zeroxvee
					</a>
				</div>
			</div>
		</footer>
	);
};
