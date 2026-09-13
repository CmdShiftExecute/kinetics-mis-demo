# Kinetics MIS

<!-- BEGIN graft-codegraph (managed by ~/server-ops/bin/codegraph-build.sh — edits inside are overwritten) -->

## Read the code graph before you read the code

This repo has a **Graft code graph**: every file, function, class and method as a
node, every call and import as an edge. It is 405 nodes and 988 edges,
rebuilt nightly at 04:35 GST. **Use it before grepping or reading whole files.**
Reading this repo's source in full costs orders of magnitude more context than
the three commands below.

```bash
graft map    --dir /home/sharmas0910/.cache/graft/kinetics-mis /home/sharmas0910/code/kinetics-mis-demo                 # whole-repo orientation, cheap
graft ask    --dir /home/sharmas0910/.cache/graft/kinetics-mis "<question>" /home/sharmas0910/code/kinetics-mis-demo    # locate code, returns file:line
graft skeleton --dir /home/sharmas0910/.cache/graft/kinetics-mis <file> /home/sharmas0910/code/kinetics-mis-demo        # one file's API surface, no bodies
```

**Rules that matter here:**

- **Never pass `--deep`.** That is the metered LLM pass and needs his explicit
  approval. Everything above is deterministic tree-sitter and costs nothing.
- **The graph can be stale mid-day.** `graft check --dir /home/sharmas0910/.cache/graft/kinetics-mis /home/sharmas0910/code/kinetics-mis-demo` reports it;
  a refresh is free and deterministic, so refresh rather than distrust it.
- The cache lives at `/home/sharmas0910/.cache/graft/kinetics-mis`, outside this repo, so the working tree stays clean.
- Browse it visually at https://node-ss.tail640a1e.ts.net:923/

<!-- END graft-codegraph -->
