import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import { createElement } from "react"
import type { ReactNode } from "react"

/**
 * Shared chrome for every transactional email. Inline styles only — email
 * clients ignore <style> and external CSS, and we avoid a Tailwind build step.
 */

const BRAND = "Kino"

const styles = {
  body: {
    backgroundColor: "#f6f7f9",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: 0,
    padding: "24px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    margin: "0 auto",
    maxWidth: "480px",
    padding: "32px",
  },
  brand: {
    color: "#111827",
    fontSize: "18px",
    fontWeight: 700,
    margin: "0 0 24px",
  },
  heading: {
    color: "#111827",
    fontSize: "22px",
    fontWeight: 600,
    margin: "0 0 12px",
  },
  text: {
    color: "#374151",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px",
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: 600,
    padding: "12px 20px",
    textDecoration: "none",
  },
  code: {
    backgroundColor: "#f3f4f6",
    borderRadius: "8px",
    color: "#111827",
    display: "inline-block",
    fontFamily: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
    fontSize: "26px",
    fontWeight: 700,
    letterSpacing: "6px",
    padding: "12px 20px",
  },
  hr: { borderColor: "#e5e7eb", margin: "24px 0" },
  muted: {
    color: "#9ca3af",
    fontSize: "13px",
    lineHeight: "20px",
    margin: 0,
    wordBreak: "break-all" as const,
  },
} as const

export function EmailLayout(props: { preview: string; children: ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>{BRAND}</Text>
          {props.children}
        </Container>
      </Body>
    </Html>
  )
}

export function EmailHeading(props: { children: ReactNode }) {
  return <Heading style={styles.heading}>{props.children}</Heading>
}

export function EmailText(props: { children: ReactNode }) {
  return <Text style={styles.text}>{props.children}</Text>
}

export function EmailButton(props: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "24px 0" }}>
      <Button href={props.href} style={styles.button}>
        {props.children}
      </Button>
    </Section>
  )
}

export function EmailCode(props: { children: ReactNode }) {
  return (
    <Section style={{ margin: "24px 0" }}>
      <Text style={styles.code}>{props.children}</Text>
    </Section>
  )
}

export function EmailFallbackLink(props: { url: string }) {
  return (
    <>
      <Hr style={styles.hr} />
      <Text style={styles.muted}>
        If the button doesn’t work, copy and paste this link:
        <br />
        {props.url}
      </Text>
    </>
  )
}

// Ensure the JSX factory import is retained by bundlers that tree-shake.
void createElement
