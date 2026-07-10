"use client";

import { Bookmark } from "lucide-react";

import { SpotSaveFooter } from "@/components/recollect/spot-save-footer";
import { SpotListRow } from "@/components/spots/spot-list-row";
import { EmptyState } from "@/components/ui/empty-state";
import { useRecollect } from "@/lib/recollect/use-recollect";
import { spotPath } from "@/lib/share/paths";
import type { Spot } from "@/lib/spots/browser-api";

type FriendSpotListProps = {
  spots: Spot[];
};

export function FriendSpotList({ spots }: FriendSpotListProps) {
  if (spots.length === 0) {
    return (
      <EmptyState className="rounded-2xl p-4">
        まだスポットがありません。
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-3">
      {spots.map((spot) => (
        <FriendSpotRow key={spot.id} spot={spot} />
      ))}
    </ul>
  );
}

function FriendSpotRow({ spot }: { spot: Spot }) {
  const recollect = useRecollect(spot.id);

  return (
    <li>
      <SpotListRow
        spot={spot}
        href={spotPath(spot.id)}
        footer={
          <SpotSaveFooter spotId={spot.id} recollect={recollect}>
            <div className="mt-3">
              <SpotSaveFooter.SaveButton
                label="保存"
                icon={<Bookmark className="size-3.5" aria-hidden />}
                variant="secondary"
                size="sm"
                className="w-full"
              />
              <SpotSaveFooter.Error className="mt-2" />
            </div>
            <SpotSaveFooter.Picker />
          </SpotSaveFooter>
        }
      />
    </li>
  );
}
