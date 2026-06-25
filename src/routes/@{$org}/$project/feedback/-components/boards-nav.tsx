import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';

import { useRegisterShortcuts } from '@/components/shortcuts';
import { SidebarNavGroup, SidebarNavItem } from '@/components/sidebar-nav';
import { Icon, type IconName } from '@/icons';

// Single shortcut covering 1–9; the digit pressed selects the board at that
// position in the list below (1 = All).
const BOARD_SELECT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Only the fields this nav actually reads. The query returns richer board docs,
// but a structural subset keeps the synthetic "All" entry valid and gives us
// type-checked access to `slug`/`name`/`icon`.
type FeedbackBoardNavItem = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
};

export function BoardsNav({
  boards,
}: {
  boards: FeedbackBoardNavItem[] | null;
}) {
  const routePath = '/@{$org}/$project/feedback/';
  const { org, project } = useParams({ from: routePath });
  const { board: boardParam } = useSearch({ from: routePath });
  const navigate = useNavigate();

  const allBoards = useMemo(
    () => [{ id: 'all', name: 'All', icon: 'box', slug: 'all' }, ...(boards ?? [])],
    [boards]
  );

  const shortcuts = useMemo(
    () => [
      {
        group: 'Feedback' as const,
        id: 'feedback.select-board',
        keys: BOARD_SELECT_KEYS,
        label: '1–9',
        description: 'Select board by position',
        run: ({ key }: { key: string }) => {
          const target = allBoards[Number(key) - 1];
          if (!target) return;
          navigate({
            params: { org, project },
            search: (prev) => ({ ...prev, board: target.slug }),
            to: '/@{$org}/$project/feedback',
          });
        },
      },
    ],
    [allBoards, navigate, org, project]
  );

  useRegisterShortcuts('feedback-boards', shortcuts);

  if (!boards) return <div>No boards</div>;

  return (
    <SidebarNavGroup>
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
          {({ isActive }) => (
            <SidebarNavItem
              active={board.slug === boardParam || isActive}
              icon={<Icon fallback="box" name={board?.icon as IconName} size="16px" />}
            >
              {board.name}
            </SidebarNavItem>
          )}
        </Link>
      ))}
    </SidebarNavGroup>
  );
}
