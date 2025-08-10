# Nix Gitea/Forgejo Cache Action

[![check](https://img.shields.io/github/actions/workflow/status/spotdemo4/nix-gitea-cache-action/check.yaml?logo=GitHub&logoColor=%23cdd6f4&label=check&labelColor=%2311111b)](https://github.com/spotdemo4/nix-gitea-cache-action/actions/workflows/check.yaml)
[![flake](https://img.shields.io/github/actions/workflow/status/spotdemo4/nix-gitea-cache-action/flake.yaml?logo=nixos&logoColor=%2389dceb&label=flake&labelColor=%2311111b)](https://github.com/spotdemo4/nix-gitea-cache-action/actions/workflows/flake.yaml)

This action saves and restores the nix store to/from the actions cache. It is mainly useful for Gitea & Forgejo, as they are unsupported by the other nix cache actions. It is crude, it saves the entire nix cache even if the package is no longer used.

For GitHub, use
- https://github.com/DeterminateSystems/magic-nix-cache-action
- https://github.com/nix-community/cache-nix-action

If you're fine with an unfree option, use
- https://github.com/cachix/cachix-action

## Requirements

Any action that installs Nix
- https://github.com/DeterminateSystems/nix-installer-action
- https://github.com/cachix/install-nix-action

## Inputs

### `key`

An explicit key for the cache entry. Defaults to a hash of `flake.lock`, if it exists.

## Outputs

### `cache-hit`

A string value to indicate an exact match was found for the key. `"true"` or `"false"`.

## Example usage

```yaml
uses: https://github.com/DeterminateSystems/nix-installer-action@main
uses: https://github.com/spotdemo4/nix-gitea-cache-action@main
```
