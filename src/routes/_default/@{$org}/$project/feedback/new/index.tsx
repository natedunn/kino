import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_default/@{$org}/$project/feedback/new/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_default/@$org/$project/feedback/new/"!</div>
}
