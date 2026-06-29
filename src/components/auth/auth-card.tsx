import type { ReactNode } from "react"

/**
 * Presentational parts for the auth pages. The card *box* (border, radius,
 * background, shadow, padding, centering, full-bleed-on-mobile) lives once in
 * the layout route (routes/auth.tsx) wrapping the <Outlet/>. Each page only
 * renders its header / fields / footer inside that shared box.
 */

export function AuthHeader(props: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-6 space-y-1.5">
      <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>
      {props.description ? (
        <p className="text-sm text-muted-foreground">{props.description}</p>
      ) : null}
    </div>
  )
}

export function AuthFooter(props: { children: ReactNode }) {
  return (
    <div className="mt-6 border-t pt-4 text-sm text-muted-foreground">
      {props.children}
    </div>
  )
}

/** A labeled input row used across the auth forms. */
export function AuthField(props: {
  id: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor={props.id}>
        {props.label}
      </label>
      {props.children}
    </div>
  )
}
