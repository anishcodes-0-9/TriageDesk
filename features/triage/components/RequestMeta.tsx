import { Badge } from "@/components/ui/Badge";
import type { Category, Owner } from "@/lib/taxonomy";
import { categoryDisplay, ownerDisplay } from "../display/triageDisplay";

/**
 * Molecule: displays already-decided classification/routing metadata.
 * Category and owner are both trusted input — this component never derives
 * one from the other, it only looks up how each should be shown.
 */
export type RequestMetaProps = {
  category: Category;
  owner: Owner;
};

export function RequestMeta({ category, owner }: RequestMetaProps) {
  const categoryMeta = categoryDisplay(category);
  const ownerMeta = ownerDisplay(owner);

  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <div className="flex items-center gap-2">
        <dt className="text-text-muted">Category</dt>
        <dd>
          <Badge label={categoryMeta.label} tone={categoryMeta.tone} />
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="text-text-muted">Owner</dt>
        <dd>
          <Badge label={ownerMeta.label} tone={ownerMeta.tone} />
        </dd>
      </div>
    </dl>
  );
}
