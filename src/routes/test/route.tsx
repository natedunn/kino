import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/test')({
  component: RouteComponent,
  loader: async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
  },
  pendingComponent: () => {
    return <div>Pending: in route.tsx</div>
  },
  errorComponent: () => {
    return <div>Error: in route.tsx</div>
  },
  notFoundComponent: () => {
    return <div>Not Found: in route.tsx</div>
  },
})

function RouteComponent() {
  return (
    <>
      Route.tsx wrapper <br />
      <Outlet />
    </>
  )
}
