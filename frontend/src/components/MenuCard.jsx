export default function MenuCard({ item, onAdd, busy }) {
  return (
    <article className="menu-card">
      <div className="menu-card-copy">
        <span className="menu-card-tag">FROM THE MENU</span>
        <h3>{item.name}</h3>
        <p>{item.description || "Made fresh with ingredients we love."}</p>
        <strong className="menu-price">${Number(item.price).toFixed(2)}</strong>
      </div>
      <div className="menu-card-media">
        {item.image_url ? <img src={item.image_url} alt="" loading="lazy" /> : <div className="menu-placeholder" aria-hidden="true">✦</div>}
        <button className="add-button" onClick={() => onAdd(item)} disabled={busy} aria-label={`Add ${item.name} to cart`}>{busy ? <span className="spinner-border spinner-border-sm" role="status" /> : "+"}</button>
      </div>
    </article>
  );
}
