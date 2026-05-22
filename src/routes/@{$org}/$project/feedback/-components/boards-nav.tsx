import { Link, useParams, useSearch } from '@tanstack/react-router';

import { buttonVariants } from '@/components/ui/button';
import { Icon, type IconName } from '@/icons';
import { cn } from '@/lib/utils';

export function BoardsNav({ boards }: { boards: any[] | null }) {
  const routePath = '/@{$org}/$project/feedback/';
  const { org, project } = useParams({ from: routePath });
  const { board: boardParam } = useSearch({ from: routePath });

  if (!boards) return <div>No boards</div>;

  const allBoards = [
    { id: 'all', name: 'All', icon: 'box', slug: 'all' },
    ...boards,
  ];

  return (
    <div className="flex flex-col gap-1">
      {allBoards.map((board) => (
        <Link
          key={board.id}
          params={{ org, project }}
          search={(prev) => ({
            ...prev,
            board: board.slug,
          })}
          to="/@{$org}/$project/feedback"
        >
          {({ isActive }) => {
            const active = board.slug === boardParam || isActive;
            return (
              <span
                className={cn(
                  active
                    ? buttonVariants({ variant: 'outline', className: 'pointer-events-none' })
                    : buttonVariants({ variant: 'ghost' }),
                  'group inline-flex! w-full items-center justify-start text-left'
                )}
              >
                <span className="mr-auto inline-flex items-center gap-3">
                  <Icon fallback="box" name={board?.icon as IconName} size="16px" />
                  <span>{board.name}</span>
                </span>
              </span>
            );
          }}
        </Link>
      ))}
    </div>
  );
}
