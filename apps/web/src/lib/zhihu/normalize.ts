import { SearchEvidenceItemSchema, type SearchEvidenceItem } from "@ask-better/domain";
import type { ZhihuRawSearchItem } from "./client";

export function normalizeZhihuSearchItem(item: ZhihuRawSearchItem): SearchEvidenceItem {
  return SearchEvidenceItemSchema.parse({
    id: item.ContentID,
    title: item.Title,
    contentType: item.ContentType,
    summary: item.ContentText,
    url: item.Url,
    author: item.AuthorName,
    editedAt: item.EditTime,
    rankingScore: item.RankingScore,
    authorityLevel: item.AuthorityLevel,
    voteUpCount: item.VoteUpCount,
    commentCount: item.CommentCount,
    selectedComments: item.CommentInfoList?.map((comment) => comment.Content) ?? [],
    source: "zhihu"
  });
}
