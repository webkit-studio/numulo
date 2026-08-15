import Link from "next/link";

interface Option {
  id: number;
  name: string;
  color?: string;
}

/**
 * Filters as links rather than a form: every combination stays a URL you can
 * bookmark or send, and the page keeps working with JavaScript off. Search is
 * the one real form, because typing needs an input.
 */
export function TransactionFilters({
  categories,
  users,
  month,
  search,
  ownerId,
  categoryId,
  business,
  transfer,
  reviewOnly,
  reviewCount,
}: {
  categories: Option[];
  users: Option[];
  month: string;
  search: string | null;
  ownerId: string | null;
  categoryId: string | null;
  business: boolean;
  transfer: boolean;
  reviewOnly: boolean;
  reviewCount: number;
}) {
  const build = (overrides: Record<string, string | null>) => {
    const query = new URLSearchParams();
    query.set("mesic", month);
    if (search) query.set("hledat", search);
    if (ownerId) query.set("kdo", ownerId);
    if (categoryId) query.set("kategorie", categoryId);
    if (business) query.set("podnikani", "1");
    if (transfer) query.set("prevody", "1");
    if (reviewOnly) query.set("schvalit", "1");

    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    return `/transakce?${query.toString()}`;
  };

  return (
    <div className="filters">
      <form method="get" action="/transakce" className="filter-search">
        <input type="hidden" name="mesic" value={month} />
        <input
          type="search"
          name="hledat"
          placeholder="Hledat obchodníka nebo popis"
          defaultValue={search ?? ""}
          aria-label="Hledat"
        />
        <button type="submit">Hledat</button>
      </form>

      <div className="chips" role="group" aria-label="Kdo">
        <Link
          href={build({ kdo: null })}
          className={`chip${ownerId ? "" : " is-on"}`}
        >
          Všichni
        </Link>
        {users.map((user) => (
          <Link
            key={user.id}
            href={build({ kdo: String(user.id) })}
            className={`chip${ownerId === String(user.id) ? " is-on" : ""}`}
          >
            {user.name}
          </Link>
        ))}
      </div>

      <div className="chips" role="group" aria-label="Kategorie">
        <Link
          href={build({ kategorie: null })}
          className={`chip${categoryId ? "" : " is-on"}`}
        >
          Vše
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={build({ kategorie: String(category.id) })}
            className={`chip${categoryId === String(category.id) ? " is-on" : ""}`}
          >
            <span
              className="envelope-dot"
              style={{ background: category.color }}
              aria-hidden="true"
            />
            {category.name}
          </Link>
        ))}
      </div>

      <div className="chips" role="group" aria-label="Zvláštní">
        {/* Off by default: both are excluded from every household total, so
            showing them unasked makes the list disagree with the numbers. */}
        <Link
          href={build({ podnikani: business ? null : "1" })}
          className={`chip${business ? " is-on" : ""}`}
        >
          Podnikání
        </Link>
        <Link
          href={build({ prevody: transfer ? null : "1" })}
          className={`chip${transfer ? " is-on" : ""}`}
        >
          Převody
        </Link>
        {/* Only offered when there is something to review — an always-present
            chip that always shows nothing teaches people to ignore it. */}
        {reviewCount > 0 || reviewOnly ? (
          <Link
            href={build({ schvalit: reviewOnly ? null : "1" })}
            className={`chip${reviewOnly ? " is-on" : ""}`}
          >
            Ke schválení · {reviewCount}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
