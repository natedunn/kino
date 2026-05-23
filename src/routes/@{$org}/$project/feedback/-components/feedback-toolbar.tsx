import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearch } from '@tanstack/react-router';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectPositioner,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Filter from '@/icons/filter';

const FROM_ROUTE = '/@{$org}/$project/feedback/';
const TO_ROUTE = '/@{$org}/$project/feedback';
const STATUS_OPTIONS = [
  { label: 'All statuses', value: null },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Closed', value: 'closed' },
] as const;

export function FeedbackToolbar() {
  const { navigate } = useRouter();
  const searchParams = useSearch({ from: FROM_ROUTE });
  const { search, status, board } = searchParams;
  const { org, project } = useParams({ from: FROM_ROUTE });
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState(!search ? '' : search);

  const setSearchParams = (next: Omit<typeof searchParams, 'board'>) => {
    navigate({
      params: { org, project },
      search: (prev) => ({
        ...prev,
        ...next,
        board: board ?? 'all',
      }),
      to: TO_ROUTE,
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSearchParams({ search: undefined, status: undefined });
  };

  const hasActiveFilters = status;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchParams({
        search: searchTerm.trim() === '' ? undefined : searchTerm,
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters || hasActiveFilters ? 'default' : 'outline'}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {hasActiveFilters ? (
              <Badge
                className="ml-2 flex h-5 w-5 items-center justify-center rounded-full p-0 pr-px text-[10px]"
                variant="secondary"
              >
                {[status].filter(Boolean).length}
              </Badge>
            ) : null}
          </Button>

          {hasActiveFilters ? (
            <Button
              onClick={() => {
                setShowFilters(false);
                clearFilters();
              }}
              variant="outline"
            >
              <X className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Input
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search..."
            value={searchTerm}
          />
        </div>
      </div>

      {(showFilters || hasActiveFilters) ? (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-muted-foreground" htmlFor="status-filter">
                Status
              </label>
              <Select
                items={STATUS_OPTIONS}
                onValueChange={(value) => {
                  setSearchParams({
                    status: (value ?? undefined) as typeof status,
                  });
                }}
                value={!status ? null : status}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectPositioner alignItemWithTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(({ label, value }) => (
                      <SelectItem key={`value-${value ?? 'undefined'}`} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectPositioner>
              </Select>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
