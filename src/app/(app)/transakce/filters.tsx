import Link from "next/link";

/**
 * Filters as links, not a form.
 *
 * Every combination stays a URL you can bookmark or send, and the page keeps
 * working with JavaScript off. Search is the one real form, because typing
 * needs an input.
 */
export function TransactionFilters({
  categories,
  members,
  month,
  search,
  categoryId,
  ownerId,
  showBusiness,
  showTransfers,
}: {
  categories: { id: string; name: string; color: string }[];
  members: { id: string; name: string }[];
  month: string;
  search: string | null;
  categoryId: string | null;
  ownerId: string | null;
  showBusiness: boolean;
  showTransfers: boolean;
}) {
  const build = (overrides: Record<string, string | null>) => {
    const query = new URLSearchParams();
    query.set("mesic", month);
    if (search) query.set("hledat", search);
    if (categoryId) query.set("kategorie", categoryId);
    if (ownerId) query.set("kdo", ownerId);
    if (showBusiness) query.set("podnikani", "1");
    if (showTransfers) query.set("prevody", "1");

    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    return `/transakce?${query.toString()}`;
  };

  const anyFilter = Boolean(search || categoryId || ownerId || showBusiness || showTransfers);

  return (
    <section className="card filters">
      <form method="get" action="/transakce" className="filter-search">
        <input type="hidden" name="mesic" value={month} />
        <input
          className="input"
          type="search"
          name="hledat"
          placeholder="Hledat obchodníka nebo popis"
          defaultValue={search ?? ""}
          aria-label="Hledat"
        />
        <button type="submit" className="btn">Hledat</button>
      </form>

      {members.length > 1 ? (
        <div className="chips" role="group" aria-label="Kdo">
          <Link href={build({ kdo: null })} className={`chip${ownerId ? "" : " is-on"}`}>
            Všichni
          </Link>
          {members.map((member) => (
            <Link
              key={member.id}
              href={build({ kdo: member.id })}
              className={`chip${ownerId === member.id ? " is-on" : ""}`}
            >
              {member.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="chips" role="group" aria-label="Kategorie">
        <Link href={build({ kategorie: null })} className={`chip${categoryId ? "" : " is-on"}`}>
          Vše
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={build({ kategorie: category.id })}
            className={`chip${categoryId === category.id ? " is-on" : ""}`}
          >
            <span className="dot" style={{ background: category.color }} aria-hidden="true" />
            {category.name}
          </Link>
        ))}
      </div>

      <div className="chips" role="group" aria-label="Zvláštní">
        <Link
          href={build({ podnikani: showBusiness ? null : "1" })}
          className={`chip chip-dashed${showBusiness ? " is-on" : ""}`}
        >
          Podnikání
        </Link>
        <Link
          href={build({ prevody: showTransfers ? null : "1" })}
          className={`chip chip-dashed${showTransfers ? " is-on" : ""}`}
        >
          Převody
        </Link>
        {anyFilter ? (
          <Link href={`/transakce?mesic=${month}`} className="chip">zrušit filtry</Link>
        ) : null}
      </div>
    </section>
  );
}
