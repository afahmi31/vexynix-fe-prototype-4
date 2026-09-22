"use client";

const trustItems = [
  {
    icon: "fa-solid fa-shield-halved",
    title: "Bermain Lebih Aman",
    copy: "Kami berkomitmen untuk menciptakan lingkungan bermain yang aman dan nyaman.",
  },
  {
    icon: "fa-solid fa-gift",
    title: "Bonus & Promosi",
    copy: "Dapatkan info terbaru tentang bonus, turnamen, dan penawaran spesial.",
  },
  {
    icon: "fa-solid fa-headset",
    title: "Pusat Bantuan",
    copy: "Tim kami siap membantu 24/7. Hubungi kami kapan saja.",
  },
] as const;

export function LobbyTrustStrip() {
  return (
    <section className="lobby-trust-strip" id="bantuan" aria-label="Bantuan VEXYNIX">
      {trustItems.map((item) => (
        <article className="lobby-trust-card" key={item.title}>
          <span className="lobby-trust-icon" aria-hidden="true">
            <i className={item.icon} />
          </span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
