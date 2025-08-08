{
  description = "Gitea Nix Cache Action";

  nixConfig = {
    extra-substituters = [
      "https://trevnur.cachix.org"
    ];
    extra-trusted-public-keys = [
      "trevnur.cachix.org-1:hBd15IdszwT52aOxdKs5vNTbq36emvEeGqpb25Bkq6o="
    ];
  };

  inputs = {
    systems.url = "systems";
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    utils = {
      url = "github:numtide/flake-utils";
      inputs.systems.follows = "systems";
    };
    nur = {
      url = "github:nix-community/NUR";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    nixpkgs,
    utils,
    nur,
    ...
  }:
    utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {
        inherit system;
        overlays = [nur.overlays.default];
      };
    in rec {
      devShells.default = pkgs.mkShell {
        packages = with pkgs; [
          git
          pkgs.nur.repos.trev.bumper

          nodejs_20
          biome
          prettier

          # Nix
          alejandra

          # Actions
          action-validator
          pkgs.nur.repos.trev.renovate
        ];
        shellHook = pkgs.nur.repos.trev.shellhook.ref;
      };

      checks =
        pkgs.nur.repos.trev.lib.mkChecks {
          lint = {
            src = ./.;
            nativeBuildInputs = with pkgs; [
              biome
              prettier
              alejandra
              action-validator
              pkgs.nur.repos.trev.renovate
            ];
            checkPhase = ''
              biome check .
              prettier --check .
              alejandra -c .
              renovate-config-validator
              action-validator .github/workflows/*
            '';
          };
        }
        // {
          shell = devShells.default;
        };

      formatter = pkgs.alejandra;
    });
}
