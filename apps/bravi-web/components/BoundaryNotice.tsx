export function BoundaryNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="boundary-notice" role="status">
      <span aria-hidden="true">!</span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </section>
  )
}
