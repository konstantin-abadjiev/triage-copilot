# Clustering prompt

Use this to group duplicates and near duplicates before scoring.

## Rules

- Group items that solve the same user problem, even if the words differ. Example: "Patients keep calling because they cannot reset their password" and "Portal login fails after password change" are the same cluster.
- Do not group items that only share a keyword. Example: "Payment reminders" and "Payment plans" are different clusters, even though both mention payment.
- Name each cluster with the clearest item title in the group.
- Keep a cluster to one theme. If a group spans two themes, split it.
- Record the cluster size, the representative item id, and the ids of the duplicates.
- Score the cluster once, using the representative item, and note how many duplicates it absorbed.

## Duplicate signals, in order

1. Same outcome for the same user.
2. Same workflow step.
3. Same wording or synonyms.
4. Same source and requester, reporting the same issue again.

## Output format

Return one JSON object per cluster:
{"cluster_id": "C01", "theme": "...", "representative_id": "...", "item_ids": ["...", "..."], "size": 2, "reason": "..."}
