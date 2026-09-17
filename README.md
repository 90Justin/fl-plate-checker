# fl-plate-checker

Checks Florida personalized plate availability against the official
[FLHSMV form](https://services.flhsmv.gov/MVCheckPersonalPlate/).

## Use

Needs Node 20+.

```sh
npm install
npm run check                        # reads plates.txt
npm run check -- --plates "NTH,AYE"
```

Prints a table and writes the available ones to `available.txt`.

## Options

| Flag | Default | |
| --- | --- | --- |
| `--file <path>` | `plates.txt` | one candidate per line |
| `--plates "A,B"` | | check these instead of a file |
| `--out <path>` | `available.txt` | where available plates go |
| `--delay <ms>` | `2500` | pause between requests |
| `--json` | | JSON instead of a table |

## Notes

- Input is uppercased and `O` folded to `0`. Florida doesn't manufacture the
  letter O, so the system substitutes zero.
- Max 7 characters; a space or hyphen counts toward the limit. Longer input is
  rejected locally, before any request.
- Five plates per request, 2.5s apart. It's a public state service — keep runs
  modest and don't parallelize.
- **Availability is not approval.** The county tax collector runs the binding
  check at order time, and configurations are separately reviewed for
  objectionable content.

`npm test` covers input validation.

MIT.
