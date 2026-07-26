import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ModulePlaceholderProps = {
  title: string;
  description: string;
};

export function ModulePlaceholder({
  title,
  description,
}: ModulePlaceholderProps) {
  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium text-muted-foreground">
          Módulo da clínica
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {title}
        </h1>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">{description}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}