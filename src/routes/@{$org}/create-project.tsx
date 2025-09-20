import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/@{$org}/create-project')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/@$org/create-project"!</div>
}
